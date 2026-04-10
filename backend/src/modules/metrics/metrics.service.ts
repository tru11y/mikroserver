import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  Prisma,
  RouterStatus,
  SessionStatus,
  SubscriptionStatus,
  TransactionStatus,
  UserRole,
  VoucherStatus,
} from "@prisma/client";
import { scopeToOwner } from "../../common/helpers/tenant-scope.helper";
import { startOfDay, subDays, startOfMonth, endOfDay } from "date-fns";
import { QueueService } from "../queue/queue.service";
import { Redis } from "ioredis";
import { InjectRedis } from "../queue/decorators/inject-redis.decorator";
import {
  buildDisplayName,
  buildSubscriptionDailyList,
  clampConfidence,
  getRecommendationPriorityRank,
} from "./metrics.service.helpers";
import {
  exportTicketReportCsvOperation,
  getIncidentCenterOperation,
  getTicketReportOperation,
} from "./metrics.service.operations";

export interface DashboardStats {
  activeSessions: number;
  revenueToday: number;
  revenueThisMonth: number;
  newCustomersToday: number;
  totalVouchersGenerated: number;
  totalVouchersUsed: number;
  routersOnline: number;
  routersTotal: number;
  topRouters: Array<{
    id: string;
    name: string;
    revenue: number;
    sessions: number;
  }>;
  recentSessions: Array<{
    id: string;
    username: string;
    macAddress: string;
    routerName: string;
    createdAt: string;
    durationSeconds: number;
  }>;
}

export interface DashboardKpis {
  revenue: {
    today: number;
    thisMonth: number;
    last30Days: number;
    total: number;
  };
  transactions: {
    today: number;
    thisMonth: number;
    successRate: number; // percentage
    pending: number;
  };
  vouchers: {
    activeToday: number;
    deliveryFailures: number;
  };
  routers: {
    online: number;
    offline: number;
    total: number;
  };
  customers: {
    uniqueToday: number;
    uniqueThisMonth: number;
  };
}

export interface RevenueChartPoint {
  date: string;
  revenueXof: number;
  transactions: number;
}

export interface SubscriptionTimelineEntry {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  autoRenew: boolean;
  priceXof: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface SubscriptionDailyList {
  date: string;
  count: number;
  uniqueCustomers: number;
  totalRevenueXof: number;
  items: SubscriptionTimelineEntry[];
}

export interface TopRecurringClient {
  userId: string;
  customerName: string;
  customerEmail: string;
  subscriptionsCount: number;
  totalSpentXof: number;
  lastSubscriptionAt: string | null;
}

export interface TopRecurringPlan {
  planId: string;
  planName: string;
  subscriptionsCount: number;
  totalRevenueXof: number;
  lastSubscriptionAt: string | null;
}

export interface RecurringClientsSummary {
  windowDays: number;
  generatedAt: string;
  items: TopRecurringClient[];
}

export interface RecurringPlansSummary {
  windowDays: number;
  generatedAt: string;
  items: TopRecurringPlan[];
}

type SubscriptionWithRelations = Prisma.subscriptionsGetPayload<{
  include: {
    users_subscriptions_user_idTousers: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
      };
    };
    plans: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

export interface TicketReport {
  filters: {
    startDate: string;
    endDate: string;
    operatorId?: string;
    planId?: string;
  };
  summary: {
    created: number;
    activated: number;
    completed: number;
    deleted: number;
    deliveryFailed: number;
    totalActivatedAmountXof: number;
    routersTouched: number;
    operatorsTouched: number;
    plansTouched: number;
  };
  breakdowns: {
    routers: TicketReportBreakdownRow[];
    operators: TicketReportBreakdownRow[];
    plans: TicketReportBreakdownRow[];
  };
  recentDeliveryFailures: TicketReportFailureRow[];
}

export interface TicketReportBreakdownRow {
  id: string;
  name: string;
  secondaryLabel?: string | null;
  created: number;
  activated: number;
  completed: number;
  deliveryFailed: number;
  activatedAmountXof: number;
}

export interface TicketReportFailureRow {
  code: string;
  routerName?: string | null;
  operatorName?: string | null;
  error?: string | null;
  updatedAt: string;
}

export type OperationalIncidentSeverity =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export type OperationalIncidentType =
  | "ROUTER_OFFLINE"
  | "ROUTER_DEGRADED"
  | "ROUTER_SYNC_ERROR"
  | "UNMATCHED_USERS"
  | "DELIVERY_FAILURES"
  | "QUEUE_BACKLOG"
  | "OVERDUE_SESSIONS"
  | "LOW_VOUCHER_STOCK";

export interface OperationalIncident {
  id: string;
  severity: OperationalIncidentSeverity;
  type: OperationalIncidentType;
  title: string;
  description: string;
  detectedAt: string;
  entityType: "router" | "voucher" | "queue" | "system";
  entityId?: string;
  routerId?: string;
  routerName?: string;
  metadata?: Record<string, unknown>;
}

export interface IncidentCenter {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    offlineRouters: number;
    degradedRouters: number;
    routersWithSyncErrors: number;
    routersWithUnmatchedUsers: number;
    deliveryFailures: number;
    voucherQueueBacklog: number;
    webhookQueueBacklog: number;
  };
  incidents: OperationalIncident[];
  generatedAt: string;
}

export type DailyRecommendationPriority = "HIGH" | "MEDIUM" | "LOW";
export type DailyRecommendationCategory =
  | "OPERATIONS"
  | "RETENTION"
  | "CATALOG";

export interface DailyRecommendation {
  id: string;
  title: string;
  summary: string;
  category: DailyRecommendationCategory;
  priority: DailyRecommendationPriority;
  confidence: number; // 0..1
  reasons: string[];
  actionLabel: string;
  actionPath: string;
  generatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface DailyRecommendationsResponse {
  generatedAt: string;
  items: DailyRecommendation[];
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly routerOfflineThresholdMinutes = 15;
  private readonly unmatchedUsersHighThreshold = 5;
  private readonly queueBacklogMediumThreshold = 5;
  private readonly queueBacklogHighThreshold = 20;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ---------------------------------------------------------------------------
  // Dashboard KPIs — optimized with parallel queries
  // ---------------------------------------------------------------------------

  async getDashboardKpis(actor: {
    sub: string;
    role: UserRole;
  }): Promise<DashboardKpis> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = startOfMonth(now);
    const thirtyDaysAgo = subDays(now, 30);

    // Tenant isolation: ADMIN sees only their own routers/transactions
    const routerOwnerScope = scopeToOwner(actor.sub, actor.role);
    // Transactions don't have a direct ownerId; they're linked via voucher→router
    const txOwnerScope: Prisma.TransactionWhereInput =
      actor.role === UserRole.SUPER_ADMIN
        ? {}
        : { voucher: { router: { ownerId: actor.sub } } };
    const voucherOwnerScope: Prisma.VoucherWhereInput =
      actor.role === UserRole.SUPER_ADMIN
        ? {}
        : { router: { ownerId: actor.sub } };

    // Execute all queries in parallel
    const [
      revenueToday,
      revenueMonth,
      revenueLast30,
      revenueTotal,
      txToday,
      txMonth,
      txSuccess30d,
      txTotal30d,
      txPending,
      activeVouchers,
      failedDeliveries,
      routerCounts,
      customersToday,
      customersMonth,
    ] = await Promise.all([
      // Revenue today
      this.prisma.transaction.aggregate({
        where: {
          ...txOwnerScope,
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: todayStart },
        },
        _sum: { amountXof: true },
      }),

      // Revenue this month
      this.prisma.transaction.aggregate({
        where: {
          ...txOwnerScope,
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: monthStart },
        },
        _sum: { amountXof: true },
      }),

      // Revenue last 30 days
      this.prisma.transaction.aggregate({
        where: {
          ...txOwnerScope,
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: thirtyDaysAgo },
        },
        _sum: { amountXof: true },
      }),

      // Revenue total
      this.prisma.transaction.aggregate({
        where: { ...txOwnerScope, status: TransactionStatus.COMPLETED },
        _sum: { amountXof: true },
      }),

      // Transactions today
      this.prisma.transaction.count({
        where: {
          ...txOwnerScope,
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: todayStart },
        },
      }),

      // Transactions this month
      this.prisma.transaction.count({
        where: {
          ...txOwnerScope,
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: monthStart },
        },
      }),

      // Success rate (last 30 days)
      this.prisma.transaction.count({
        where: {
          ...txOwnerScope,
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      this.prisma.transaction.count({
        where: {
          ...txOwnerScope,
          status: {
            in: [TransactionStatus.COMPLETED, TransactionStatus.FAILED],
          },
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      // Pending transactions
      this.prisma.transaction.count({
        where: { ...txOwnerScope, status: TransactionStatus.PENDING },
      }),

      // Active vouchers today
      this.prisma.voucher.count({
        where: { ...voucherOwnerScope, activatedAt: { gte: todayStart } },
      }),

      // Failed deliveries
      this.prisma.voucher.count({
        where: { ...voucherOwnerScope, status: "DELIVERY_FAILED" },
      }),

      // Router status (scoped by owner)
      this.prisma.router.groupBy({
        by: ["status"],
        where: { deletedAt: null, ...routerOwnerScope },
        _count: true,
      }),

      // Unique customers today
      this.prisma.transaction.findMany({
        where: {
          ...txOwnerScope,
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: todayStart },
        },
        distinct: ["customerPhone"],
        select: { customerPhone: true },
      }),

      // Unique customers this month
      this.prisma.transaction.findMany({
        where: {
          ...txOwnerScope,
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: monthStart },
        },
        distinct: ["customerPhone"],
        select: { customerPhone: true },
      }),
    ]);

    const onlineRouters = routerCounts
      .filter(
        (r) =>
          r.status === RouterStatus.ONLINE ||
          r.status === RouterStatus.DEGRADED,
      )
      .reduce((sum, r) => sum + r._count, 0);
    const totalRouters = routerCounts.reduce((sum, r) => sum + r._count, 0);

    return {
      revenue: {
        today: revenueToday._sum.amountXof ?? 0,
        thisMonth: revenueMonth._sum.amountXof ?? 0,
        last30Days: revenueLast30._sum.amountXof ?? 0,
        total: revenueTotal._sum.amountXof ?? 0,
      },
      transactions: {
        today: txToday,
        thisMonth: txMonth,
        successRate:
          txTotal30d > 0 ? Math.round((txSuccess30d / txTotal30d) * 100) : 0,
        pending: txPending,
      },
      vouchers: {
        activeToday: activeVouchers,
        deliveryFailures: failedDeliveries,
      },
      routers: {
        online: onlineRouters,
        offline: totalRouters - onlineRouters,
        total: totalRouters,
      },
      customers: {
        uniqueToday: customersToday.length,
        uniqueThisMonth: customersMonth.length,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Revenue chart data (last N days)
  // ---------------------------------------------------------------------------

  async getRevenueChart(
    days = 30,
    actor?: { sub: string; role: UserRole },
  ): Promise<RevenueChartPoint[]> {
    const from = subDays(new Date(), days);

    const txOwnerScope: Prisma.TransactionWhereInput =
      actor && actor.role !== UserRole.SUPER_ADMIN
        ? { voucher: { router: { ownerId: actor.sub } } }
        : {};

    const transactions = await this.prisma.transaction.findMany({
      where: {
        ...txOwnerScope,
        status: TransactionStatus.COMPLETED,
        paidAt: { gte: from },
      },
      select: { paidAt: true, amountXof: true },
      orderBy: { paidAt: "asc" },
    });

    // Group by day
    const dailyMap = new Map<string, { revenue: number; count: number }>();

    for (const tx of transactions) {
      if (!tx.paidAt) continue;
      const day = tx.paidAt.toISOString().slice(0, 10);
      const existing = dailyMap.get(day) ?? { revenue: 0, count: 0 };
      dailyMap.set(day, {
        revenue: existing.revenue + tx.amountXof,
        count: existing.count + 1,
      });
    }

    return Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      revenueXof: data.revenue,
      transactions: data.count,
    }));
  }

  async getSubscriptionsStartedToday(): Promise<SubscriptionDailyList> {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    const rows = await this.prisma.subscriptions.findMany({
      where: {
        created_at: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING],
        },
      },
      include: {
        users_subscriptions_user_idTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        plans: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return buildSubscriptionDailyList(dayStart, rows);
  }

  async getSubscriptionsExpiringToday(): Promise<SubscriptionDailyList> {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    const rows = await this.prisma.subscriptions.findMany({
      where: {
        end_date: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING],
        },
      },
      include: {
        users_subscriptions_user_idTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        plans: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { end_date: "asc" },
    });

    return buildSubscriptionDailyList(dayStart, rows);
  }

  async getTopRecurringClients(
    windowDays = 30,
    limit = 10,
  ): Promise<RecurringClientsSummary> {
    const safeWindowDays = Math.min(Math.max(windowDays, 1), 365);
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const windowStart = startOfDay(subDays(new Date(), safeWindowDays - 1));

    const grouped = await this.prisma.subscriptions.groupBy({
      by: ["user_id"],
      where: {
        created_at: { gte: windowStart },
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.EXPIRED,
            SubscriptionStatus.CANCELLED,
            SubscriptionStatus.SUSPENDED,
          ],
        },
      },
      _count: { _all: true },
      _sum: { price_xof: true },
      _max: { created_at: true },
    });

    const userIds = grouped.map((row) => row.user_id);
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        })
      : [];

    const usersById = new Map(users.map((user) => [user.id, user]));

    const items = grouped
      .map((row) => {
        const user = usersById.get(row.user_id);
        const customerName = user
          ? buildDisplayName(user.firstName, user.lastName, user.email)
          : `Client ${row.user_id}`;

        return {
          userId: row.user_id,
          customerName,
          customerEmail: user?.email ?? "",
          subscriptionsCount: row._count._all,
          totalSpentXof: row._sum.price_xof ?? 0,
          lastSubscriptionAt: row._max.created_at?.toISOString() ?? null,
        } satisfies TopRecurringClient;
      })
      .sort((left, right) => {
        if (right.subscriptionsCount !== left.subscriptionsCount) {
          return right.subscriptionsCount - left.subscriptionsCount;
        }

        if (right.totalSpentXof !== left.totalSpentXof) {
          return right.totalSpentXof - left.totalSpentXof;
        }

        return (
          new Date(right.lastSubscriptionAt ?? 0).getTime() -
          new Date(left.lastSubscriptionAt ?? 0).getTime()
        );
      })
      .slice(0, safeLimit);

    return {
      windowDays: safeWindowDays,
      generatedAt: new Date().toISOString(),
      items,
    };
  }

  async getTopRecurringPlans(
    windowDays = 30,
    limit = 10,
  ): Promise<RecurringPlansSummary> {
    const safeWindowDays = Math.min(Math.max(windowDays, 1), 365);
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const windowStart = startOfDay(subDays(new Date(), safeWindowDays - 1));

    const grouped = await this.prisma.subscriptions.groupBy({
      by: ["plan_id"],
      where: {
        created_at: { gte: windowStart },
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.EXPIRED,
            SubscriptionStatus.CANCELLED,
            SubscriptionStatus.SUSPENDED,
          ],
        },
      },
      _count: { _all: true },
      _sum: { price_xof: true },
      _max: { created_at: true },
    });

    const planIds = grouped.map((row) => row.plan_id);
    const plans = planIds.length
      ? await this.prisma.plan.findMany({
          where: { id: { in: planIds } },
          select: {
            id: true,
            name: true,
          },
        })
      : [];

    const plansById = new Map(plans.map((plan) => [plan.id, plan]));

    const items = grouped
      .map((row) => {
        const plan = plansById.get(row.plan_id);
        return {
          planId: row.plan_id,
          planName: plan?.name ?? `Forfait ${row.plan_id}`,
          subscriptionsCount: row._count._all,
          totalRevenueXof: row._sum.price_xof ?? 0,
          lastSubscriptionAt: row._max.created_at?.toISOString() ?? null,
        } satisfies TopRecurringPlan;
      })
      .sort((left, right) => {
        if (right.subscriptionsCount !== left.subscriptionsCount) {
          return right.subscriptionsCount - left.subscriptionsCount;
        }

        if (right.totalRevenueXof !== left.totalRevenueXof) {
          return right.totalRevenueXof - left.totalRevenueXof;
        }

        return (
          new Date(right.lastSubscriptionAt ?? 0).getTime() -
          new Date(left.lastSubscriptionAt ?? 0).getTime()
        );
      })
      .slice(0, safeLimit);

    return {
      windowDays: safeWindowDays,
      generatedAt: new Date().toISOString(),
      items,
    };
  }

  async getDailyRecommendations(): Promise<DailyRecommendationsResponse> {
    const generatedAt = new Date().toISOString();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      incidentCenter,
      expiringToday,
      topClients,
      topPlans,
      revenueThisWeek,
      revenueLastWeek,
    ] = await Promise.all([
      this.getIncidentCenter(),
      this.getSubscriptionsExpiringToday(),
      this.getTopRecurringClients(30, 5),
      this.getTopRecurringPlans(30, 5),
      this.prisma.transaction.aggregate({
        where: { status: "COMPLETED", paidAt: { gte: sevenDaysAgo } },
        _sum: { amountXof: true },
        _count: { id: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          status: "COMPLETED",
          paidAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
        _sum: { amountXof: true },
        _count: { id: true },
      }),
    ]);

    const items: DailyRecommendation[] = [];

    // Revenue anomaly detection
    const revThis = revenueThisWeek._sum.amountXof ?? 0;
    const revLast = revenueLastWeek._sum.amountXof ?? 0;
    if (revLast > 0 && revThis < revLast * 0.6) {
      const dropPct = Math.round(((revLast - revThis) / revLast) * 100);
      items.push({
        id: "revenue-drop",
        title: `Baisse de revenus détectée: −${dropPct}%`,
        summary:
          `Cette semaine: ${revThis.toLocaleString("fr-FR")} XOF vs ${revLast.toLocaleString("fr-FR")} XOF la semaine précédente. ` +
          "Vérifiez les routeurs hors ligne et le stock de tickets.",
        category: "OPERATIONS",
        priority: dropPct >= 50 ? "HIGH" : "MEDIUM",
        confidence: clampConfidence(0.6 + Math.min(0.3, dropPct / 100)),
        reasons: [
          `Revenus S-1: ${revLast.toLocaleString("fr-FR")} XOF (${revenueLastWeek._count.id} tx)`,
          `Revenus S-0: ${revThis.toLocaleString("fr-FR")} XOF (${revenueThisWeek._count.id} tx)`,
          `Chute: ${dropPct}%`,
        ],
        actionLabel: "Voir analytics",
        actionPath: "/analytics",
        generatedAt,
        metadata: { revThis, revLast, dropPct },
      });
    }

    for (const incident of incidentCenter.incidents.slice(0, 6)) {
      const criticalityBoost =
        incident.severity === "CRITICAL"
          ? 0.95
          : incident.severity === "HIGH"
            ? 0.85
            : incident.severity === "MEDIUM"
              ? 0.7
              : 0.55;

      items.push({
        id: `incident-${incident.id}`,
        title: `Incident: ${incident.title}`,
        summary: incident.description,
        category: "OPERATIONS",
        priority:
          incident.severity === "CRITICAL" || incident.severity === "HIGH"
            ? "HIGH"
            : incident.severity === "MEDIUM"
              ? "MEDIUM"
              : "LOW",
        confidence: criticalityBoost,
        reasons: [
          `Severite detectee: ${incident.severity}`,
          `Type: ${incident.type}`,
          incident.routerName
            ? `Routeur concerne: ${incident.routerName}`
            : `Entite: ${incident.entityType}`,
        ],
        actionLabel: "Ouvrir incidents",
        actionPath: "/incidents",
        generatedAt,
        metadata: {
          incidentId: incident.id,
          routerId: incident.routerId,
          type: incident.type,
        },
      });
    }

    for (const subscription of expiringToday.items.slice(0, 5)) {
      const confidence = clampConfidence(
        0.6 +
          Math.min(0.25, subscription.priceXof / 200_000) +
          (subscription.autoRenew ? -0.15 : 0.1),
      );

      items.push({
        id: `renewal-${subscription.id}`,
        title: `Relancer ${subscription.customerName}`,
        summary: `${subscription.planName} expire aujourd'hui.`,
        category: "RETENTION",
        priority: subscription.autoRenew ? "LOW" : "MEDIUM",
        confidence,
        reasons: [
          `Forfait: ${subscription.planName}`,
          `Montant: ${subscription.priceXof.toLocaleString("fr-FR")} XOF`,
          subscription.autoRenew
            ? "Renouvellement auto actif"
            : "Renouvellement auto inactif",
        ],
        actionLabel: "Voir abonnements",
        actionPath: "/analytics",
        generatedAt,
        metadata: {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          planId: subscription.planId,
        },
      });
    }

    for (const client of topClients.items.slice(0, 3)) {
      items.push({
        id: `client-${client.userId}`,
        title: `Client recurrent: ${client.customerName}`,
        summary:
          `${client.subscriptionsCount} abonnement(s) sur 30 jours. ` +
          `Potentiel upsell/cross-sell.`,
        category: "RETENTION",
        priority: client.subscriptionsCount >= 3 ? "MEDIUM" : "LOW",
        confidence: clampConfidence(
          0.55 +
            Math.min(0.2, client.subscriptionsCount / 15) +
            Math.min(0.2, client.totalSpentXof / 500_000),
        ),
        reasons: [
          `Frequence: ${client.subscriptionsCount} abonnement(s)`,
          `Valeur: ${client.totalSpentXof.toLocaleString("fr-FR")} XOF`,
          client.lastSubscriptionAt
            ? `Dernier abonnement: ${new Date(client.lastSubscriptionAt).toLocaleDateString("fr-FR")}`
            : "Dernier abonnement: n/a",
        ],
        actionLabel: "Voir analytics",
        actionPath: "/analytics",
        generatedAt,
        metadata: {
          userId: client.userId,
        },
      });
    }

    for (const plan of topPlans.items.slice(0, 3)) {
      items.push({
        id: `plan-${plan.planId}`,
        title: `Forfait performant: ${plan.planName}`,
        summary:
          `${plan.subscriptionsCount} abonnement(s) recents. ` +
          `Verifier stock tickets et disponibilite commerciale.`,
        category: "CATALOG",
        priority: plan.subscriptionsCount >= 5 ? "MEDIUM" : "LOW",
        confidence: clampConfidence(
          0.55 +
            Math.min(0.25, plan.subscriptionsCount / 20) +
            Math.min(0.15, plan.totalRevenueXof / 700_000),
        ),
        reasons: [
          `Volume: ${plan.subscriptionsCount} abonnement(s)`,
          `Revenu: ${plan.totalRevenueXof.toLocaleString("fr-FR")} XOF`,
        ],
        actionLabel: "Voir forfaits",
        actionPath: "/plans",
        generatedAt,
        metadata: {
          planId: plan.planId,
        },
      });
    }

    const ranked = items.sort((left, right) => {
      const priorityRank =
        getRecommendationPriorityRank(right.priority) -
        getRecommendationPriorityRank(left.priority);
      if (priorityRank !== 0) {
        return priorityRank;
      }

      return right.confidence - left.confidence;
    });

    return {
      generatedAt,
      items: ranked.slice(0, 15),
    };
  }

  async getTicketReport(filters: {
    startDate?: string;
    endDate?: string;
    operatorId?: string;
    planId?: string;
  }): Promise<TicketReport> {
    return getTicketReportOperation(this.prisma, filters);
  }

  async exportTicketReportCsv(filters: {
    startDate?: string;
    endDate?: string;
    operatorId?: string;
    planId?: string;
  }): Promise<string> {
    return exportTicketReportCsvOperation(this.prisma, filters);
  }

  async getIncidentCenter(): Promise<IncidentCenter> {
    return getIncidentCenterOperation(this.prisma, this.queueService, {
      routerOfflineThresholdMinutes: this.routerOfflineThresholdMinutes,
      unmatchedUsersHighThreshold: this.unmatchedUsersHighThreshold,
      queueBacklogMediumThreshold: this.queueBacklogMediumThreshold,
      queueBacklogHighThreshold: this.queueBacklogHighThreshold,
    });
  }

  // ---------------------------------------------------------------------------
  // Dashboard stats — combined view for operational dashboard
  // ---------------------------------------------------------------------------

  async getDashboardStats(
    userId: string,
    userRole: UserRole,
  ): Promise<DashboardStats> {
    const cacheKey = `metrics:dashboard:${userId}:${userRole}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as DashboardStats;
      }
    } catch (err) {
      this.logger.warn(
        `Redis cache read failed for ${cacheKey}: ${String(err)}`,
      );
    }

    const result = await this.computeDashboardStats(userId, userRole);

    try {
      await this.redis.set(cacheKey, JSON.stringify(result), "EX", 30);
    } catch (err) {
      this.logger.warn(
        `Redis cache write failed for ${cacheKey}: ${String(err)}`,
      );
    }

    return result;
  }

  private async computeDashboardStats(
    userId: string,
    userRole: UserRole,
  ): Promise<DashboardStats> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = startOfMonth(now);

    // ADMIN scoping: filter by router.ownerId; SUPER_ADMIN sees everything
    const routerOwnerFilter: Prisma.RouterWhereInput =
      userRole === UserRole.SUPER_ADMIN ? {} : { ownerId: userId };

    // Fetch routers for scoped queries
    const scopedRouters = await this.prisma.router.findMany({
      where: { deletedAt: null, ...routerOwnerFilter },
      select: { id: true, name: true, status: true },
    });

    const scopedRouterIds = scopedRouters.map((r) => r.id);
    const routerIdFilter =
      userRole === UserRole.SUPER_ADMIN
        ? {}
        : { routerId: { in: scopedRouterIds } };

    const [
      activeSessions,
      revenueToday,
      revenueThisMonth,
      newCustomersToday,
      totalVouchersGenerated,
      totalVouchersUsed,
      recentSessionsRaw,
    ] = await Promise.all([
      // Active sessions (from DB, not live RouterOS)
      this.prisma.session.count({
        where: { status: SessionStatus.ACTIVE, ...routerIdFilter },
      }),

      // Revenue today (transactions linked to scoped routers via voucher)
      userRole === UserRole.SUPER_ADMIN
        ? this.prisma.transaction.aggregate({
            where: {
              status: TransactionStatus.COMPLETED,
              paidAt: { gte: todayStart },
            },
            _sum: { amountXof: true },
          })
        : this.prisma.transaction.aggregate({
            where: {
              status: TransactionStatus.COMPLETED,
              paidAt: { gte: todayStart },
              voucher: { routerId: { in: scopedRouterIds } },
            },
            _sum: { amountXof: true },
          }),

      // Revenue this month
      userRole === UserRole.SUPER_ADMIN
        ? this.prisma.transaction.aggregate({
            where: {
              status: TransactionStatus.COMPLETED,
              paidAt: { gte: monthStart },
            },
            _sum: { amountXof: true },
          })
        : this.prisma.transaction.aggregate({
            where: {
              status: TransactionStatus.COMPLETED,
              paidAt: { gte: monthStart },
              voucher: { routerId: { in: scopedRouterIds } },
            },
            _sum: { amountXof: true },
          }),

      // New customer profiles created today (scoped to owned routers)
      this.prisma.customerProfile.count({
        where: {
          createdAt: { gte: todayStart },
          ...(userRole !== UserRole.SUPER_ADMIN
            ? { routerId: { in: scopedRouterIds } }
            : {}),
        },
      }),

      // Total vouchers generated (not expired/deleted)
      this.prisma.voucher.count({
        where: {
          status: {
            notIn: [VoucherStatus.EXPIRED, VoucherStatus.REVOKED],
          },
          ...routerIdFilter,
        },
      }),

      // Total vouchers used (ACTIVE status = currently in use)
      this.prisma.voucher.count({
        where: {
          status: VoucherStatus.ACTIVE,
          ...routerIdFilter,
        },
      }),

      // Last 10 active sessions with router name
      this.prisma.session.findMany({
        where: { status: SessionStatus.ACTIVE, ...routerIdFilter },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          macAddress: true,
          createdAt: true,
          router: { select: { name: true } },
          voucher: { select: { code: true } },
        },
      }),
    ]);

    // Router counts from already-fetched scopedRouters
    const routersOnline = scopedRouters.filter(
      (r) =>
        r.status === RouterStatus.ONLINE || r.status === RouterStatus.DEGRADED,
    ).length;
    const routersTotal = scopedRouters.length;

    // Top 5 routers by revenue this month
    const topRoutersRaw = await (userRole === UserRole.SUPER_ADMIN
      ? this.prisma.transaction.groupBy({
          by: ["planId"],
          where: {
            status: TransactionStatus.COMPLETED,
            paidAt: { gte: monthStart },
            voucher: { routerId: { not: null } },
          },
          _sum: { amountXof: true },
          _count: { _all: true },
        })
      : Promise.resolve([]));

    // Build top routers via a raw aggregation
    const topRoutersData = await this.buildTopRouters(
      scopedRouterIds,
      monthStart,
      userRole === UserRole.SUPER_ADMIN ? null : scopedRouterIds,
    );

    const recentSessions = recentSessionsRaw.map((s) => ({
      id: s.id,
      username: s.voucher?.code ?? "unknown",
      macAddress: s.macAddress ?? "",
      routerName: s.router.name,
      createdAt: s.createdAt.toISOString(),
      durationSeconds: Math.floor(
        (now.getTime() - s.createdAt.getTime()) / 1000,
      ),
    }));

    // Suppress unused variable warning
    void topRoutersRaw;

    return {
      activeSessions,
      revenueToday: revenueToday._sum.amountXof ?? 0,
      revenueThisMonth: revenueThisMonth._sum.amountXof ?? 0,
      newCustomersToday,
      totalVouchersGenerated,
      totalVouchersUsed,
      routersOnline,
      routersTotal,
      topRouters: topRoutersData,
      recentSessions,
    };
  }

  private async buildTopRouters(
    scopedRouterIds: string[],
    monthStart: Date,
    filterIds: string[] | null,
  ): Promise<
    Array<{ id: string; name: string; revenue: number; sessions: number }>
  > {
    const whereRouterIds = filterIds ?? scopedRouterIds;

    // Aggregate revenue by router via voucher join
    const revenueByRouter = await this.prisma.$queryRaw<
      Array<{ router_id: string; total_revenue: bigint; session_count: bigint }>
    >`
      SELECT
        v."router_id",
        COALESCE(SUM(t."amount_xof"), 0)  AS total_revenue,
        COUNT(DISTINCT s."id")             AS session_count
      FROM vouchers v
      LEFT JOIN transactions t
        ON t."id" = v."transaction_id"
        AND t."status" = 'COMPLETED'
        AND t."paid_at" >= ${monthStart}
      LEFT JOIN sessions s
        ON s."voucher_id" = v."id"
        AND s."status" = 'ACTIVE'
      WHERE v."router_id" = ANY(${whereRouterIds}::uuid[])
      GROUP BY v."router_id"
      ORDER BY total_revenue DESC
      LIMIT 5
    `;

    if (!revenueByRouter.length) return [];

    const routerIds = revenueByRouter.map((r) => r.router_id);
    const routers = await this.prisma.router.findMany({
      where: { id: { in: routerIds } },
      select: { id: true, name: true },
    });

    const routerMap = new Map(routers.map((r) => [r.id, r]));

    return revenueByRouter.map((row) => ({
      id: row.router_id,
      name: routerMap.get(row.router_id)?.name ?? row.router_id,
      revenue: Number(row.total_revenue),
      sessions: Number(row.session_count),
    }));
  }

  // ---------------------------------------------------------------------------
  // Daily snapshot generation (called by cron)
  // ---------------------------------------------------------------------------

  async generateDailySnapshot(date: Date): Promise<void> {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const [completed, failed, revenue, uniqueCustomers] = await Promise.all([
      this.prisma.transaction.count({
        where: {
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      this.prisma.transaction.count({
        where: {
          status: TransactionStatus.FAILED,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: dayStart, lte: dayEnd },
        },
        _sum: { amountXof: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: dayStart, lte: dayEnd },
        },
        distinct: ["customerPhone"],
        select: { customerPhone: true },
      }),
    ]);

    const totalRevenue = revenue._sum.amountXof ?? 0;

    await this.prisma.revenueSnapshot.upsert({
      where: { date: dayStart },
      create: {
        date: dayStart,
        successfulTransactions: completed,
        failedTransactions: failed,
        totalTransactions: completed + failed,
        grossRevenueXof: totalRevenue,
        netRevenueXof: totalRevenue,
        uniqueCustomers: uniqueCustomers.length,
      },
      update: {
        successfulTransactions: completed,
        failedTransactions: failed,
        totalTransactions: completed + failed,
        grossRevenueXof: totalRevenue,
        netRevenueXof: totalRevenue,
        uniqueCustomers: uniqueCustomers.length,
      },
    });

    this.logger.log(
      `Daily snapshot generated for ${dayStart.toISOString().slice(0, 10)}`,
    );
  }
}
