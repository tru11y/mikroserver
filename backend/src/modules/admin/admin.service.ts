import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UserRole, UserStatus, TransactionStatus } from "@prisma/client";
import { startOfMonth } from "date-fns";

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

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Per-operator stats require separate queries (Prisma doesn't support
    // nested aggregations in the same pass).  We batch them in parallel.
    const monthStart = startOfMonth(new Date());

    const statsResults = await Promise.all(
      operators.map(async (op) => {
        const routerIds = op.routersOwned.map((r) => r.id);

        // Short-circuit: no routers means no vouchers and no revenue
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
   * Only callable by SUPER_ADMIN.
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

    if (routerIds.length === 0) {
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
      routerCount: op.routersOwned.length,
      activeRouterCount: activeRouters,
      totalVouchers: voucherCount,
      revenueThisMonthXof: revenueMonth._sum.amountXof ?? 0,
      revenueTotalXof: revenueTotal._sum.amountXof ?? 0,
    };
  }
}
