import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { ConfigService } from '@nestjs/config';
import { VoucherStatus, Voucher, GenerationType } from '@prisma/client';
import { addMinutes } from 'date-fns';
import { RouterApiService } from '../routers/router-api.service';

const CODE_LENGTH = 12;
const COLLISION_MAX_RETRIES = 3;
const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class VoucherService {
  private readonly logger = new Logger(VoucherService.name);
  private readonly voucherPrefix: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly routerApiService: RouterApiService,
  ) {
    this.voucherPrefix = this.configService.get<string>(
      'mikrotik.voucherPrefix',
      'MS',
    );
  }

  // ---------------------------------------------------------------------------
  // List / Get
  // ---------------------------------------------------------------------------

  async findAll(page: number, limit: number, createdById?: string) {
    const skip = (page - 1) * limit;
    const where = createdById ? { createdById } : {};
    const [items, total] = await Promise.all([
      this.prisma.voucher.findMany({
        skip,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: { select: { name: true, priceXof: true, durationMinutes: true } },
          createdBy: { select: { firstName: true, lastName: true, email: true } },
          router: { select: { name: true, status: true } },
        },
      }),
      this.prisma.voucher.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        code: item.code,
        status: item.status,
        expiresAt: item.expiresAt,
        createdAt: item.createdAt,
        deliveredAt: item.deliveredAt,
        generationType: item.generationType,
        routerId: item.routerId,
        routerName: item.router?.name ?? null,
        routerStatus: item.router?.status ?? null,
        planName: item.plan.name,
        planPriceXof: item.plan.priceXof,
        planDurationMinutes: item.plan.durationMinutes,
        createdByName: item.createdBy
          ? `${item.createdBy.firstName} ${item.createdBy.lastName}`.trim()
          : null,
        lastDeliveryError: item.lastDeliveryError,
        deliveryAttempts: item.deliveryAttempts,
      })),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
      include: {
        plan: true,
        transaction: true,
        router: { select: { id: true, name: true, status: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!voucher) throw new NotFoundException(`Voucher ${id} not found`);
    return voucher;
  }

  // ---------------------------------------------------------------------------
  // Generate after successful payment (AUTO)
  // ---------------------------------------------------------------------------

  async generateForTransaction(
    transactionId: string,
    planId: string,
    routerId?: string,
  ): Promise<Voucher> {
    const existing = await this.prisma.voucher.findUnique({
      where: { transactionId },
    });

    if (existing) {
      this.logger.warn(`Voucher already exists for transaction ${transactionId}`);
      return existing;
    }

    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: planId } });
    const code = await this.generateUniqueCode();
    const password = this.generatePassword();
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
    });

    const expiresAt = addMinutes(new Date(), plan.durationMinutes + 5);

    const voucher = await this.prisma.voucher.create({
      data: {
        transactionId,
        planId,
        routerId,
        generationType: GenerationType.AUTO,
        code,
        passwordHash,
        passwordPlain: password,
        status: VoucherStatus.GENERATED,
        expiresAt,
        mikrotikComment: `Ref:${transactionId.slice(0, 8)} Plan:${plan.slug}`,
      },
    });

    this.logger.log(`Voucher generated: ${voucher.id} code=${code} tx=${transactionId}`);

    await this.queueService.enqueueVoucherDelivery({
      voucherId: voucher.id,
      routerId: routerId,
    });

    return voucher;
  }

  // ---------------------------------------------------------------------------
  // Bulk MANUAL generation (for resellers / admins, no transaction needed)
  // ---------------------------------------------------------------------------

  async generateBulk(
    planId: string,
    routerId: string,
    count: number,
    createdById?: string,
  ): Promise<Array<Voucher & { plan: { name: string; priceXof: number; durationMinutes: number } }>> {
    if (count < 1 || count > 500) {
      throw new Error('Count must be between 1 and 500');
    }

    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: planId, status: 'ACTIVE' },
    });

    const vouchers: Voucher[] = [];

    for (let i = 0; i < count; i++) {
      const code = await this.generateUniqueCode();
      const password = this.generatePassword();
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
      });

      const voucher = await this.prisma.voucher.create({
        data: {
          planId,
          routerId,
          createdById: createdById ?? null,
          generationType: GenerationType.MANUAL,
          code,
          passwordHash,
          passwordPlain: password,
          status: VoucherStatus.GENERATED,
          mikrotikComment: `MANUAL Plan:${plan.slug}`,
        },
      });

      await this.queueService.enqueueVoucherDelivery({
        voucherId: voucher.id,
        routerId,
      });

      vouchers.push(voucher);
    }

    this.logger.log(
      `Bulk generated ${count} MANUAL vouchers for plan "${plan.slug}" by ${createdById ?? 'system'}`,
    );

    return this.prisma.voucher.findMany({
      where: {
        id: {
          in: vouchers.map((voucher) => voucher.id),
        },
      },
      include: {
        plan: {
          select: {
            name: true,
            priceXof: true,
            durationMinutes: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Revoke
  // ---------------------------------------------------------------------------

  async revokeVoucher(voucherId: string): Promise<Voucher> {
    const voucher = await this.prisma.voucher.findUnique({ where: { id: voucherId } });
    if (!voucher) throw new NotFoundException(`Voucher ${voucherId} not found`);
    if (voucher.status === VoucherStatus.REVOKED) return voucher;

    if (voucher.routerId) {
      await this.routerApiService.disconnectActiveSessionsByUsername(
        voucher.routerId,
        voucher.code,
      );
      await this.routerApiService.removeHotspotUser(voucher.routerId, voucher.code);
    }

    return this.prisma.voucher.update({
      where: { id: voucherId },
      data: { status: VoucherStatus.REVOKED, revokedAt: new Date() },
    });
  }

  async redeliverVoucher(voucherId: string): Promise<{ queued: boolean; voucherId: string }> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
      include: { plan: true, router: true },
    });

    if (!voucher) throw new NotFoundException(`Voucher ${voucherId} not found`);
    if (!voucher.routerId) {
      throw new ConflictException('Voucher has no assigned router');
    }
    if (voucher.status === VoucherStatus.REVOKED || voucher.status === VoucherStatus.EXPIRED) {
      throw new ConflictException(`Voucher cannot be re-delivered in status ${voucher.status}`);
    }

    await this.prisma.voucher.update({
      where: { id: voucherId },
      data: {
        status: VoucherStatus.GENERATED,
        lastDeliveryError: null,
      },
    });

    await this.queueService.enqueueVoucherDelivery({
      voucherId,
      routerId: voucher.routerId,
    });

    this.logger.log(`Voucher ${voucherId} queued again for delivery`);

    return { queued: true, voucherId };
  }

  // ---------------------------------------------------------------------------
  // Data for PDF export
  // ---------------------------------------------------------------------------

  async getVouchersForPdf(voucherIds: string[]): Promise<{
    code: string;
    password: string;
    planName: string;
    durationMinutes: number;
    priceXof: number;
  }[]> {
    const vouchers = await this.prisma.voucher.findMany({
      where: { id: { in: voucherIds } },
      include: { plan: true },
    });

    return vouchers.map((v) => ({
      code: v.code,
      password: v.passwordPlain,
      planName: v.plan.name,
      durationMinutes: v.plan.durationMinutes,
      priceXof: v.plan.priceXof,
    }));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < COLLISION_MAX_RETRIES; attempt++) {
      const code = this.generateCode();
      const existing = await this.prisma.voucher.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existing) return code;
      this.logger.warn(`Voucher code collision (attempt ${attempt + 1}): ${code}`);
    }
    throw new ConflictException('Failed to generate unique voucher code');
  }

  private generateCode(): string {
    const bytes = randomBytes(CODE_LENGTH);
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARSET[bytes[i]! % CODE_CHARSET.length];
    }
    return [
      this.voucherPrefix,
      code.slice(0, 4),
      code.slice(4, 8),
      code.slice(8, 12),
    ].join('-');
  }

  private generatePassword(): string {
    const bytes = randomBytes(8);
    let password = '';
    const charset = 'abcdefghjkmnpqrstuvwxyz23456789';
    for (let i = 0; i < 8; i++) {
      password += charset[bytes[i]! % charset.length];
    }
    return password;
  }
}
