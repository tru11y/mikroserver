import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  UserRole,
  VoucherStatus,
  GenerationType,
  TransactionStatus,
  PayoutStatus,
} from "@prisma/client";
import argon2 from "argon2";
import {
  subDays,
  startOfDay,
  startOfWeek,
  startOfMonth,
  format,
} from "date-fns";

@Injectable()
export class ResellersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    parentId: string,
    dto: {
      userId: string;
      commissionRate?: number;
      allowedRouters?: string[];
      maxVouchersDay?: number;
    },
  ) {
    // Validate user exists and has RESELLER role
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException("Utilisateur introuvable.");
    if (user.role !== UserRole.RESELLER) {
      throw new BadRequestException(
        "L'utilisateur doit avoir le rôle REVENDEUR.",
      );
    }

    // Check not already a reseller
    const existing = await this.prisma.resellerConfig.findUnique({
      where: { userId: dto.userId },
    });
    if (existing)
      throw new BadRequestException(
        "Cet utilisateur est déjà configuré comme revendeur.",
      );

    return this.prisma.resellerConfig.create({
      data: {
        userId: dto.userId,
        parentId,
        commissionRate: dto.commissionRate ?? 10,
        allowedRouters: dto.allowedRouters ?? [],
        maxVouchersDay: dto.maxVouchersDay,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  async findAll(parentId?: string, page = 1, limit = 25) {
    const skip = (Math.max(1, page) - 1) * Math.min(limit, 100);
    const where = { ...(parentId ? { parentId } : {}), isActive: true };

    const [items, total] = await Promise.all([
      this.prisma.resellerConfig.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.resellerConfig.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const config = await this.prisma.resellerConfig.findUniqueOrThrow({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            lastLoginAt: true,
          },
        },
        parent: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    return config;
  }

  async update(
    id: string,
    dto: {
      commissionRate?: number;
      allowedRouters?: string[];
      maxVouchersDay?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.resellerConfig.update({
      where: { id },
      data: {
        ...(dto.commissionRate !== undefined
          ? { commissionRate: dto.commissionRate }
          : {}),
        ...(dto.allowedRouters !== undefined
          ? { allowedRouters: dto.allowedRouters }
          : {}),
        ...(dto.maxVouchersDay !== undefined
          ? { maxVouchersDay: dto.maxVouchersDay }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async addCredit(id: string, amountXof: number) {
    if (amountXof <= 0)
      throw new BadRequestException("Le montant doit être positif.");
    return this.prisma.resellerConfig.update({
      where: { id },
      data: { creditBalance: { increment: amountXof } },
    });
  }

  async deductCredit(id: string, amountXof: number) {
    const config = await this.prisma.resellerConfig.findUniqueOrThrow({
      where: { id },
    });
    if (config.creditBalance < amountXof) {
      throw new BadRequestException(
        `Solde insuffisant: ${config.creditBalance} FCFA disponibles.`,
      );
    }
    return this.prisma.resellerConfig.update({
      where: { id },
      data: { creditBalance: { decrement: amountXof } },
    });
  }

  async recordSale(resellerId: string, saleAmountXof: number) {
    const config = await this.prisma.resellerConfig.findUniqueOrThrow({
      where: { id: resellerId },
    });

    const commission = Math.floor(
      (saleAmountXof * Number(config.commissionRate)) / 100,
    );

    return this.prisma.resellerConfig.update({
      where: { id: resellerId },
      data: {
        totalSales: { increment: saleAmountXof },
        totalCommission: { increment: commission },
        creditBalance: { increment: commission },
      },
    });
  }

  async getMyStats(resellerId: string) {
    const config = await this.prisma.resellerConfig.findUnique({
      where: { userId: resellerId },
    });

    const vouchers = await this.prisma.voucher.findMany({
      where: { createdById: resellerId },
      select: {
        id: true,
        code: true,
        status: true,
        plan: { select: { name: true, priceXof: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const totalSold = vouchers.filter(
      (v) =>
        v.status === VoucherStatus.ACTIVE || v.status === VoucherStatus.EXPIRED,
    ).length;
    const totalGenerated = vouchers.length;

    return {
      creditBalance: config?.creditBalance ?? 0,
      commissionRate: config?.commissionRate ?? 0,
      totalGenerated,
      totalSold,
      isActive: config?.isActive ?? false,
      recentVouchers: vouchers,
    };
  }

  async resellerGenerateVouchers(
    resellerId: string,
    planId: string,
    quantity: number,
  ) {
    if (quantity < 1 || quantity > 50) {
      throw new BadRequestException(
        "La quantité doit être comprise entre 1 et 50.",
      );
    }

    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: planId },
    });
    const totalCost = plan.priceXof * quantity;

    // Find config by userId to get config.id for deductCredit
    const config = await this.prisma.resellerConfig.findUnique({
      where: { userId: resellerId },
    });
    if (!config) throw new BadRequestException("Compte revendeur introuvable.");
    if (!config.isActive)
      throw new BadRequestException("Compte revendeur inactif.");

    // Deduct credit (throws if insufficient)
    await this.deductCredit(config.id, totalCost);

    // Generate vouchers
    const vouchers = await Promise.all(
      Array.from({ length: quantity }, async () => {
        const plain = this.generateVoucherPassword();
        const hash = await argon2.hash(plain, {
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
        });
        return this.prisma.voucher.create({
          data: {
            code: this.generateVoucherCode(),
            passwordPlain: plain,
            passwordHash: hash,
            planId,
            createdById: resellerId,
            status: VoucherStatus.GENERATED,
            generationType: GenerationType.MANUAL,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
          select: {
            id: true,
            code: true,
            passwordPlain: true,
            status: true,
            expiresAt: true,
            plan: { select: { name: true, priceXof: true } },
          },
        });
      }),
    );

    return { vouchers, deducted: totalCost };
  }

  private generateVoucherCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from(
      { length: 12 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  }

  private generateVoucherPassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from(
      { length: 8 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  }

  async getStats(parentId?: string) {
    const where = { ...(parentId ? { parentId } : {}) };
    const [total, active, aggregates] = await Promise.all([
      this.prisma.resellerConfig.count({ where }),
      this.prisma.resellerConfig.count({ where: { ...where, isActive: true } }),
      this.prisma.resellerConfig.aggregate({
        where,
        _sum: { totalSales: true, totalCommission: true, creditBalance: true },
      }),
    ]);

    return {
      total,
      active,
      totalSales: aggregates._sum.totalSales ?? 0,
      totalCommissions: aggregates._sum.totalCommission ?? 0,
      totalCreditBalance: aggregates._sum.creditBalance ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Commission time-series dashboard
  // ---------------------------------------------------------------------------

  async getCommissionTimeSeries(
    resellerId: string,
    period: "daily" | "weekly" | "monthly" = "daily",
    days = 30,
  ) {
    const since = subDays(startOfDay(new Date()), days);

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        createdById: resellerId,
        status: {
          in: [
            VoucherStatus.ACTIVE,
            VoucherStatus.EXPIRED,
            VoucherStatus.DELIVERED,
          ],
        },
        transaction: { status: TransactionStatus.COMPLETED },
        createdAt: { gte: since },
      },
      select: {
        createdAt: true,
        plan: { select: { priceXof: true } },
      },
    });

    const config = await this.prisma.resellerConfig.findUnique({
      where: { userId: resellerId },
      select: { commissionRate: true },
    });
    const rate = Number(config?.commissionRate ?? 10);

    // Group by period key
    const buckets = new Map<
      string,
      { sales: number; commission: number; count: number }
    >();

    for (const v of vouchers) {
      let key: string;
      if (period === "weekly") {
        key = format(
          startOfWeek(v.createdAt, { weekStartsOn: 1 }),
          "yyyy-MM-dd",
        );
      } else if (period === "monthly") {
        key = format(startOfMonth(v.createdAt), "yyyy-MM");
      } else {
        key = format(v.createdAt, "yyyy-MM-dd");
      }

      const current = buckets.get(key) ?? { sales: 0, commission: 0, count: 0 };
      const priceXof = v.plan?.priceXof ?? 0;
      current.sales += priceXof;
      current.commission += Math.floor((priceXof * rate) / 100);
      current.count += 1;
      buckets.set(key, current);
    }

    const series = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => ({ period, ...data }));

    return { period, days, series };
  }

  // ---------------------------------------------------------------------------
  // Payout requests
  // ---------------------------------------------------------------------------

  async requestPayout(resellerId: string, amountXof: number) {
    if (amountXof < 1000) {
      throw new BadRequestException(
        "Montant minimum de versement: 1 000 FCFA.",
      );
    }

    const config = await this.prisma.resellerConfig.findUnique({
      where: { userId: resellerId },
    });
    if (!config) throw new NotFoundException("Compte revendeur introuvable.");
    if (!config.isActive)
      throw new BadRequestException("Compte revendeur inactif.");
    if (config.creditBalance < amountXof) {
      throw new BadRequestException(
        `Solde insuffisant: ${config.creditBalance} FCFA disponibles, ${amountXof} FCFA demandés.`,
      );
    }

    // Check no pending request already exists
    const pending = await this.prisma.commissionPayout.findFirst({
      where: {
        resellerId: config.id,
        status: { in: [PayoutStatus.REQUESTED, PayoutStatus.PROCESSING] },
      },
    });
    if (pending) {
      throw new BadRequestException(
        "Une demande de versement est déjà en cours.",
      );
    }

    // Create payout request + reserve funds atomically
    const [payout] = await this.prisma.$transaction([
      this.prisma.commissionPayout.create({
        data: { resellerId: config.id, amountXof },
      }),
      this.prisma.resellerConfig.update({
        where: { id: config.id },
        data: { creditBalance: { decrement: amountXof } },
      }),
    ]);

    return payout;
  }

  async processPayout(
    payoutId: string,
    action: "approve" | "reject",
    waveReference?: string,
    notes?: string,
  ) {
    const payout = await this.prisma.commissionPayout.findUniqueOrThrow({
      where: { id: payoutId },
      include: { reseller: true },
    });

    if (
      payout.status !== PayoutStatus.REQUESTED &&
      payout.status !== PayoutStatus.PROCESSING
    ) {
      throw new BadRequestException("Ce versement ne peut plus être modifié.");
    }

    if (action === "approve") {
      return this.prisma.commissionPayout.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.COMPLETED,
          processedAt: new Date(),
          waveReference: waveReference ?? null,
          notes: notes ?? null,
        },
      });
    }

    // Reject: refund the reserved amount back to credit balance
    const [updated] = await this.prisma.$transaction([
      this.prisma.commissionPayout.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.REJECTED,
          processedAt: new Date(),
          notes: notes ?? "Rejeté par l'administrateur.",
        },
      }),
      this.prisma.resellerConfig.update({
        where: { id: payout.resellerId },
        data: { creditBalance: { increment: payout.amountXof } },
      }),
    ]);

    return updated;
  }

  async getPayoutHistory(resellerId: string, page = 1, limit = 25) {
    const config = await this.prisma.resellerConfig.findUnique({
      where: { userId: resellerId },
      select: { id: true },
    });
    if (!config) throw new NotFoundException("Compte revendeur introuvable.");

    const skip = (Math.max(1, page) - 1) * Math.min(limit, 100);
    const [items, total] = await Promise.all([
      this.prisma.commissionPayout.findMany({
        where: { resellerId: config.id },
        orderBy: { requestedAt: "desc" },
        skip,
        take: Math.min(limit, 100),
      }),
      this.prisma.commissionPayout.count({ where: { resellerId: config.id } }),
    ]);

    return { items, total, page, limit };
  }

  async listAllPayouts(status?: PayoutStatus, page = 1, limit = 25) {
    const skip = (Math.max(1, page) - 1) * Math.min(limit, 100);
    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.commissionPayout.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        skip,
        take: Math.min(limit, 100),
        include: {
          reseller: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.commissionPayout.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
