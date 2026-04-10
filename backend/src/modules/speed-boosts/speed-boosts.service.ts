import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RouterApiService } from "../routers/router-api.service";
import { QueueService } from "../queue/queue.service";
import { PaymentProviderRegistry } from "../payments/payment-provider.factory";
import {
  BoostStatus,
  NotificationType,
  SessionStatus,
  TransactionStatus,
  PaymentProvider,
  UserRole,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { addMinutes } from "date-fns";
import { ConfigService } from "@nestjs/config";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class SpeedBoostsService {
  private readonly logger = new Logger(SpeedBoostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly routerApiService: RouterApiService,
    private readonly queueService: QueueService,
    private readonly paymentRegistry: PaymentProviderRegistry,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Catalog
  // ---------------------------------------------------------------------------

  async listTiers(routerId?: string) {
    return this.prisma.boostTier.findMany({
      where: { isActive: true },
      orderBy: [{ priceXof: "asc" }],
    });
  }

  async createTier(dto: {
    name: string;
    downloadKbps: number;
    uploadKbps: number;
    durationMinutes: number;
    priceXof: number;
  }) {
    return this.prisma.boostTier.create({ data: dto });
  }

  async updateTier(
    tierId: string,
    dto: {
      name?: string;
      downloadKbps?: number;
      uploadKbps?: number;
      durationMinutes?: number;
      priceXof?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.boostTier.update({
      where: { id: tierId },
      data: dto,
    });
  }

  // ---------------------------------------------------------------------------
  // Purchase flow
  // ---------------------------------------------------------------------------

  async purchaseBoost(dto: {
    voucherCode: string;
    tierId: string;
    customerPhone: string;
    customerName?: string;
  }) {
    // Validate session is active
    const voucher = await this.prisma.voucher.findUnique({
      where: { code: dto.voucherCode },
      include: {
        session: true,
        plan: { select: { downloadKbps: true, uploadKbps: true } },
      },
    });

    if (!voucher) throw new NotFoundException("Voucher introuvable.");
    if (!voucher.session || voucher.session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException("Aucune session active pour ce voucher.");
    }

    // Prevent duplicate active/pending boost on same session
    const existingBoost = await this.prisma.speedBoost.findFirst({
      where: {
        sessionId: voucher.session.id,
        status: { in: [BoostStatus.PENDING, BoostStatus.ACTIVE] },
      },
    });
    if (existingBoost) {
      throw new BadRequestException(
        "Un boost est déjà actif ou en attente pour cette session.",
      );
    }

    const tier = await this.prisma.boostTier.findUnique({
      where: { id: dto.tierId },
    });
    if (!tier || !tier.isActive)
      throw new NotFoundException("Boost introuvable ou inactif.");

    const routerId = voucher.session.routerId;

    // Derive original rate-limit from plan
    const originalRateLimit = this.formatRateLimit(
      voucher.plan?.downloadKbps,
      voucher.plan?.uploadKbps,
    );

    // Generate Wave transaction reference
    const reference = `MS-${randomBytes(6).toString("hex").toUpperCase().slice(0, 12)}`;
    const idempotencyKey = `boost-${voucher.session.id}-${dto.tierId}`;
    const expiresAt = addMinutes(new Date(), 30); // Wave payment expires in 30 min

    // Create transaction + boost atomically
    const [transaction, boost] = await this.prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          reference,
          boostTierId: dto.tierId,
          customerPhone: dto.customerPhone,
          customerName: dto.customerName ?? null,
          amountXof: tier.priceXof,
          status: TransactionStatus.PENDING,
          provider: PaymentProvider.WAVE,
          expiresAt,
          idempotencyKey,
          metadata: { type: "BOOST", sessionId: voucher.session!.id },
        },
      });

      const b = await tx.speedBoost.create({
        data: {
          sessionId: voucher.session!.id,
          tierId: dto.tierId,
          transactionId: t.id,
          routerId,
          voucherUsername: voucher.code,
          status: BoostStatus.PENDING,
          originalRateLimit,
        },
      });

      return [t, b];
    });

    // Initiate Wave payment
    const provider = this.paymentRegistry.getProvider("WAVE");
    const successUrl =
      this.configService.get<string>("app.frontendUrl", "") + "/boost/success";
    const errorUrl =
      this.configService.get<string>("app.frontendUrl", "") + "/boost/error";

    const payment = await provider.createPayment({
      reference: transaction.reference,
      idempotencyKey,
      amountXof: tier.priceXof,
      customerPhone: dto.customerPhone,
      customerName: dto.customerName,
      description: `Speed Boost — ${tier.name}`,
      successUrl,
      errorUrl,
    });

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { paymentUrl: payment.paymentUrl },
    });

    return {
      boostId: boost.id,
      transactionId: transaction.id,
      paymentUrl: payment.paymentUrl,
      tier,
      expiresAt: payment.expiresAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Activation (called from webhook worker after payment success)
  // ---------------------------------------------------------------------------

  async activateBoost(transactionId: string): Promise<void> {
    const boost = await this.prisma.speedBoost.findUnique({
      where: { transactionId },
      include: { tier: true },
    });

    if (!boost) {
      this.logger.warn(`No boost found for transaction ${transactionId}`);
      return;
    }

    if (boost.status !== BoostStatus.PENDING) {
      this.logger.log(
        `Boost ${boost.id} already processed (status: ${boost.status})`,
      );
      return;
    }

    // Verify session still active
    const session = await this.prisma.session.findUnique({
      where: { id: boost.sessionId },
      select: { status: true },
    });

    if (!session || session.status !== SessionStatus.ACTIVE) {
      await this.prisma.speedBoost.update({
        where: { id: boost.id },
        data: { status: BoostStatus.FAILED },
      });
      this.logger.warn(
        `Boost ${boost.id} activation aborted — session no longer active`,
      );
      return;
    }

    const expiresAt = addMinutes(new Date(), boost.tier.durationMinutes);
    const boostRateLimit = this.formatRateLimit(
      boost.tier.downloadKbps,
      boost.tier.uploadKbps,
    );

    try {
      await this.routerApiService.updateHotspotUserRateLimit(
        boost.routerId,
        boost.voucherUsername,
        boostRateLimit,
      );
    } catch (error) {
      await this.prisma.speedBoost.update({
        where: { id: boost.id },
        data: { status: BoostStatus.FAILED },
      });
      throw error;
    }

    await this.prisma.speedBoost.update({
      where: { id: boost.id },
      data: {
        status: BoostStatus.ACTIVE,
        appliedAt: new Date(),
        expiresAt,
      },
    });

    // Schedule revert job
    const delayMs = expiresAt.getTime() - Date.now();
    await this.queueService.enqueueBoostRevert({ boostId: boost.id }, delayMs);

    // Notify session owner (best-effort)
    const voucherWithRouter = await this.prisma.voucher.findUnique({
      where: { code: boost.voucherUsername },
      include: { router: { select: { id: true, ownerId: true } } },
    });

    if (voucherWithRouter?.router?.ownerId) {
      await this.notificationsService
        .create(voucherWithRouter.router.ownerId, {
          type: NotificationType.BOOST_ACTIVATED,
          title: "Speed Boost activé",
          body: `${boost.tier.name} activé sur ${boost.voucherUsername} — expire dans ${boost.tier.durationMinutes} min`,
          data: { boostId: boost.id, tierId: boost.tierId },
          routerId: boost.routerId,
        })
        .catch(() => {});
    }

    this.logger.log(
      `Boost ${boost.id} activated for ${boost.voucherUsername} → ${boostRateLimit} for ${boost.tier.durationMinutes} min`,
    );
  }

  // ---------------------------------------------------------------------------
  // Revert (called by SpeedBoostWorker at expiresAt)
  // ---------------------------------------------------------------------------

  async revertBoost(boostId: string): Promise<void> {
    const boost = await this.prisma.speedBoost.findUnique({
      where: { id: boostId },
    });

    if (!boost || boost.status !== BoostStatus.ACTIVE) {
      this.logger.log(`Boost ${boostId} not active — skip revert`);
      return;
    }

    const originalRateLimit = boost.originalRateLimit ?? "0/0";

    try {
      await this.routerApiService.updateHotspotUserRateLimit(
        boost.routerId,
        boost.voucherUsername,
        originalRateLimit,
      );
    } catch (error) {
      // Router may be offline — still mark as REVERTED; next sync will apply
      this.logger.warn(
        `Boost ${boostId} revert failed (router offline?): ${String(error)}. Marking reverted.`,
      );
    }

    await this.prisma.speedBoost.update({
      where: { id: boostId },
      data: { status: BoostStatus.REVERTED, revertedAt: new Date() },
    });

    this.logger.log(
      `Boost ${boostId} reverted — rate-limit restored to ${originalRateLimit}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Queries (admin)
  // ---------------------------------------------------------------------------

  async listBoosts(filters: {
    sessionId?: string;
    routerId?: string;
    status?: BoostStatus;
    page?: number;
    limit?: number;
    requestingUserRole: UserRole;
    requestingUserId: string;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(filters.limit ?? 25, 100);
    const skip = (page - 1) * limit;
    const isSuperAdmin = filters.requestingUserRole === UserRole.SUPER_ADMIN;

    const where = {
      ...(filters.sessionId ? { sessionId: filters.sessionId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(!isSuperAdmin
        ? { session: { router: { ownerId: filters.requestingUserId } } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.speedBoost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { tier: true },
      }),
      this.prisma.speedBoost.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private formatRateLimit(
    downloadKbps?: number | null,
    uploadKbps?: number | null,
  ): string {
    if (!downloadKbps && !uploadKbps) return "0/0"; // unlimited
    return `${downloadKbps ?? 0}k/${uploadKbps ?? 0}k`;
  }
}
