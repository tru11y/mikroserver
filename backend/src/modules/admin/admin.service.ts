import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  BillingCycle,
  PlanStatus,
  SubscriptionStatus,
  UserRole,
  UserStatus,
  TransactionStatus,
} from "@prisma/client";
import { startOfMonth } from "date-fns";
import { SaasService } from "../saas/saas.service";
import { AuthPasswordService } from "../auth/auth-password.service";
import { normalizeAuthEmail } from "../auth/auth.utils";
import {
  AssignSubscriptionDto,
  CancelSubscriptionDto,
  ProvisionOperatorDto,
  RenewSubscriptionDto,
} from "./dto/admin.dto";

export interface OperatorSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  createdAt: Date;
  /** SaaS subscription tier name, or null if not subscribed */
  tierName: string | null;
  tierSlug: string | null;
  /** Operator subscription status */
  subscriptionStatus: string | null;
  /** Subscription end date */
  subscriptionEndDate: Date | null;
  /** Number of routers owned */
  routerCount: number;
  /** Number of active routers */
  activeRouterCount: number;
  /** Total vouchers generated */
  totalVouchers: number;
  /** Revenue this calendar month (FCFA) */
  revenueThisMonthXof: number;
  /** Total revenue all-time (FCFA) */
  revenueTotalXof: number;
}

export interface OperatorListResult {
  items: OperatorSummary[];
  total: number;
}

export interface ProvisionOperatorResult {
  operator: OperatorSummary;
  tempPassword: string;
  subscription: object | null;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly saasService: SaasService,
    private readonly passwordService: AuthPasswordService,
  ) {}

  // ---------------------------------------------------------------------------
  // Operator listing & detail
  // ---------------------------------------------------------------------------

  /**
   * Returns all ADMIN users with aggregated usage stats.
   * Only callable by SUPER_ADMIN.
   */
  async listOperators(page = 1, limit = 25): Promise<OperatorListResult> {
    const skip = (Math.max(1, page) - 1) * Math.min(limit, 100);
    const take = Math.min(limit, 100);

    const [operators, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: UserRole.ADMIN,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          operatorSubscription: {
            select: {
              status: true,
              endDate: true,
              tier: {
                select: { name: true, slug: true },
              },
            },
          },
          routersOwned: {
            where: { deletedAt: null },
            select: { id: true, status: true },
          },
        },
      }),
      this.prisma.user.count({
        where: { role: UserRole.ADMIN, deletedAt: null },
      }),
    ]);

    const monthStart = startOfMonth(new Date());

    const statsResults = await Promise.all(
      operators.map(async (op) => {
        const routerIds = op.routersOwned.map((r) => r.id);

        if (routerIds.length === 0) {
          return { voucherCount: 0, revenueMonthXof: 0, revenueTotalXof: 0 };
        }

        const [voucherCount, revenueMonth, revenueTotal] = await Promise.all([
          this.prisma.voucher.count({
            where: { routerId: { in: routerIds } },
          }),
          this.prisma.transaction.aggregate({
            where: {
              status: TransactionStatus.COMPLETED,
              paidAt: { gte: monthStart },
              voucher: { routerId: { in: routerIds } },
            },
            _sum: { amountXof: true },
          }),
          this.prisma.transaction.aggregate({
            where: {
              status: TransactionStatus.COMPLETED,
              voucher: { routerId: { in: routerIds } },
            },
            _sum: { amountXof: true },
          }),
        ]);

        return {
          voucherCount,
          revenueMonthXof: revenueMonth._sum.amountXof ?? 0,
          revenueTotalXof: revenueTotal._sum.amountXof ?? 0,
        };
      }),
    );

    const items: OperatorSummary[] = operators.map((op, i) => {
      const stats = statsResults[i]!;
      const activeRouters = op.routersOwned.filter(
        (r) => r.status === "ONLINE" || r.status === "DEGRADED",
      ).length;

      return {
        id: op.id,
        email: op.email,
        firstName: op.firstName,
        lastName: op.lastName,
        status: op.status,
        createdAt: op.createdAt,
        tierName: op.operatorSubscription?.tier.name ?? null,
        tierSlug: op.operatorSubscription?.tier.slug ?? null,
        subscriptionStatus: op.operatorSubscription
          ? String(op.operatorSubscription.status)
          : null,
        subscriptionEndDate: op.operatorSubscription?.endDate ?? null,
        routerCount: op.routersOwned.length,
        activeRouterCount: activeRouters,
        totalVouchers: stats.voucherCount,
        revenueThisMonthXof: stats.revenueMonthXof,
        revenueTotalXof: stats.revenueTotalXof,
      };
    });

    return { items, total };
  }

  /**
   * Returns a single operator's detail with full usage stats.
   */
  async getOperator(operatorId: string): Promise<OperatorSummary> {
    const op = await this.prisma.user.findUniqueOrThrow({
      where: { id: operatorId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        operatorSubscription: {
          select: {
            status: true,
            endDate: true,
            tier: { select: { name: true, slug: true } },
          },
        },
        routersOwned: {
          where: { deletedAt: null },
          select: { id: true, status: true },
        },
      },
    });

    const routerIds = op.routersOwned.map((r) => r.id);
    const monthStart = startOfMonth(new Date());

    const activeRouters = op.routersOwned.filter(
      (r) => r.status === "ONLINE" || r.status === "DEGRADED",
    ).length;

    if (routerIds.length === 0) {
      return {
        id: op.id,
        email: op.email,
        firstName: op.firstName,
        lastName: op.lastName,
        status: op.status,
        createdAt: op.createdAt,
        tierName: op.operatorSubscription?.tier.name ?? null,
        tierSlug: op.operatorSubscription?.tier.slug ?? null,
        subscriptionStatus: op.operatorSubscription
          ? String(op.operatorSubscription.status)
          : null,
        subscriptionEndDate: op.operatorSubscription?.endDate ?? null,
        routerCount: 0,
        activeRouterCount: activeRouters,
        totalVouchers: 0,
        revenueThisMonthXof: 0,
        revenueTotalXof: 0,
      };
    }

    const [voucherCount, revenueMonth, revenueTotal] = await Promise.all([
      this.prisma.voucher.count({
        where: { routerId: { in: routerIds } },
      }),
      this.prisma.transaction.aggregate({
        where: {
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: monthStart },
          voucher: { routerId: { in: routerIds } },
        },
        _sum: { amountXof: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          status: TransactionStatus.COMPLETED,
          voucher: { routerId: { in: routerIds } },
        },
        _sum: { amountXof: true },
      }),
    ]);

    return {
      id: op.id,
      email: op.email,
      firstName: op.firstName,
      lastName: op.lastName,
      status: op.status,
      createdAt: op.createdAt,
      tierName: op.operatorSubscription?.tier.name ?? null,
      tierSlug: op.operatorSubscription?.tier.slug ?? null,
      subscriptionStatus: op.operatorSubscription
        ? String(op.operatorSubscription.status)
        : null,
      subscriptionEndDate: op.operatorSubscription?.endDate ?? null,
      routerCount: op.routersOwned.length,
      activeRouterCount: activeRouters,
      totalVouchers: voucherCount,
      revenueThisMonthXof: revenueMonth._sum.amountXof ?? 0,
      revenueTotalXof: revenueTotal._sum.amountXof ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Operator provisioning
  // ---------------------------------------------------------------------------

  /**
   * Crée un compte opérateur (rôle ADMIN) et l'active immédiatement.
   * Optionnellement lui assigne un tier SaaS.
   * Retourne le mot de passe temporaire en clair (à transmettre à l'opérateur).
   */
  async provisionOperator(
    dto: ProvisionOperatorDto,
  ): Promise<ProvisionOperatorResult> {
    const normalizedEmail = normalizeAuthEmail(dto.email);

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException(
        `Un compte existe déjà pour l'email ${normalizedEmail}`,
      );
    }

    const tempPassword =
      dto.tempPassword ?? this.generateTempPassword();
    const passwordHash = await this.passwordService.hashPassword(tempPassword);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim() ?? null,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
    });

    let subscription: object | null = null;

    if (dto.tierId) {
      subscription = await this.saasService.subscribe(
        user.id,
        dto.tierId,
        dto.billingCycle ?? BillingCycle.MONTHLY,
      );
    }

    await this.seedOperatorPlans(user.id);

    const operatorSummary = await this.getOperator(user.id);

    return {
      operator: operatorSummary,
      tempPassword,
      subscription,
    };
  }

  // ---------------------------------------------------------------------------
  // Subscription management (SUPER_ADMIN acting on any operator)
  // ---------------------------------------------------------------------------

  /**
   * Liste tous les abonnements opérateurs avec tier et dates.
   */
  async listSubscriptions(page = 1, limit = 25) {
    const skip = (Math.max(1, page) - 1) * Math.min(limit, 100);
    const take = Math.min(limit, 100);

    const [items, total] = await Promise.all([
      this.prisma.operatorSubscription.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          tier: {
            select: {
              name: true,
              slug: true,
              priceXofMonthly: true,
              priceXofYearly: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.operatorSubscription.count(),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Assigne ou change le tier d'un opérateur.
   * Remplace l'abonnement existant (upsert).
   */
  async assignSubscription(operatorId: string, dto: AssignSubscriptionDto) {
    await this.assertOperatorExists(operatorId);
    return this.saasService.subscribe(
      operatorId,
      dto.tierId,
      dto.billingCycle ?? BillingCycle.MONTHLY,
    );
  }

  /**
   * Renouvelle l'abonnement d'un opérateur en étendant la date de fin.
   */
  async renewSubscription(operatorId: string, dto: RenewSubscriptionDto) {
    const sub = await this.prisma.operatorSubscription.findUnique({
      where: { userId: operatorId },
    });
    if (!sub) {
      throw new NotFoundException(
        `Aucun abonnement trouvé pour l'opérateur ${operatorId}`,
      );
    }

    const months =
      dto.months ?? (sub.billingCycle === BillingCycle.YEARLY ? 12 : 1);

    // Extend from current endDate or now (whichever is later)
    const baseDate = sub.endDate > new Date() ? sub.endDate : new Date();
    const newEndDate = new Date(baseDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    return this.prisma.operatorSubscription.update({
      where: { userId: operatorId },
      data: {
        endDate: newEndDate,
        status: SubscriptionStatus.ACTIVE,
        cancelledAt: null,
        cancellationReason: null,
      },
      include: { tier: true },
    });
  }

  /**
   * Résilie l'abonnement d'un opérateur.
   */
  async cancelSubscription(operatorId: string, dto: CancelSubscriptionDto) {
    const sub = await this.prisma.operatorSubscription.findUnique({
      where: { userId: operatorId },
    });
    if (!sub) {
      throw new NotFoundException(
        `Aucun abonnement trouvé pour l'opérateur ${operatorId}`,
      );
    }
    return this.saasService.cancel(operatorId, dto.reason);
  }

  /**
   * Retourne l'abonnement d'un opérateur spécifique.
   */
  async getOperatorSubscription(operatorId: string) {
    await this.assertOperatorExists(operatorId);
    return this.saasService.getOperatorSubscription(operatorId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Liste tous les tiers SaaS (actifs et inactifs) — vue SUPER_ADMIN.
   */
  async listAllTiers() {
    return this.prisma.saasTier.findMany({
      orderBy: { displayOrder: "asc" },
    });
  }

  private async assertOperatorExists(operatorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: operatorId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new NotFoundException(`Opérateur ${operatorId} introuvable`);
    }
    return user;
  }

  /**
   * Crée le catalogue de forfaits par défaut pour un nouvel opérateur.
   * Ces forfaits sont isolés par ownerId et visibles uniquement par cet opérateur.
   */
  private async seedOperatorPlans(operatorId: string): Promise<void> {
    const defaults = [
      {
        name: "30 minutes",
        slug: "30min",
        description: "Accès internet 30 minutes",
        durationMinutes: 30,
        priceXof: 200,
        displayOrder: 1,
      },
      {
        name: "1 heure",
        slug: "1h",
        description: "Accès internet 1 heure",
        durationMinutes: 60,
        priceXof: 500,
        displayOrder: 2,
      },
      {
        name: "2 heures",
        slug: "2h",
        description: "Accès internet 2 heures",
        durationMinutes: 120,
        priceXof: 1000,
        displayOrder: 3,
      },
      {
        name: "3 heures",
        slug: "3h",
        description: "Accès internet 3 heures",
        durationMinutes: 180,
        priceXof: 2000,
        displayOrder: 4,
      },
      {
        name: "Journée complète",
        slug: "journee",
        description: "Accès internet toute la journée",
        durationMinutes: 1440,
        priceXof: 5000,
        isPopular: true,
        displayOrder: 5,
      },
    ];

    await this.prisma.plan.createMany({
      data: defaults.map((p) => ({
        ...p,
        status: PlanStatus.ACTIVE,
        ownerId: operatorId,
      })),
      skipDuplicates: true,
    });
  }

  private generateTempPassword(): string {
    const chars =
      "ABCDEFGHJKMNPQRSTWXYZabcdefghjkmnpqrstwxyz23456789!@#$";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
  }
}
