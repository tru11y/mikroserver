import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  ChurnRisk,
  NotificationType,
  SubscriptionStatus,
  TransactionStatus,
  UserRole,
} from "@prisma/client";
import { subDays, startOfDay } from "date-fns";

export interface ChurnFactors {
  daysInactive: number;
  sessionTrendPct: number | null;
  subscriptionDaysLeft: number | null;
  revenueDeclinePct: number | null;
  routerOfflinePct: number;
  scores: {
    inactivity: number;
    sessionTrend: number;
    subscription: number;
    revenue: number;
    routerHealth: number;
  };
}

export interface ChurnScoreResult {
  userId: string;
  score: number;
  riskLevel: ChurnRisk;
  factors: ChurnFactors;
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // CRON — recalculate all churn scores daily at 4am
  // ---------------------------------------------------------------------------

  @Cron("0 0 4 * * *")
  async recalculateAllChurnScores(): Promise<void> {
    const operators = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
        deletedAt: null,
      },
      select: { id: true },
    });

    this.logger.log(
      `[Churn] Recalculating scores for ${operators.length} operators`,
    );

    for (const op of operators) {
      try {
        await this.calculateAndSaveChurnScore(op.id);
      } catch (error) {
        this.logger.error(
          `[Churn] Score failed for ${op.id}: ${String(error)}`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async getChurnScores(requestingUserRole: UserRole, requestingUserId: string) {
    const isSuperAdmin = requestingUserRole === UserRole.SUPER_ADMIN;
    const where = isSuperAdmin ? {} : { userId: requestingUserId };

    return this.prisma.churnScore.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { score: "desc" },
    });
  }

  async getChurnScore(userId: string) {
    return this.prisma.churnScore.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async calculateAndSaveChurnScore(userId: string): Promise<ChurnScoreResult> {
    const result = await this.computeScore(userId);

    const existing = await this.prisma.churnScore.findUnique({
      where: { userId },
    });
    const prevRiskLevel = existing?.riskLevel ?? null;

    await this.prisma.churnScore.upsert({
      where: { userId },
      create: {
        userId,
        score: result.score,
        riskLevel: result.riskLevel,
        prevRiskLevel,
        factors: result.factors as object,
        lastCalculatedAt: new Date(),
      },
      update: {
        score: result.score,
        riskLevel: result.riskLevel,
        prevRiskLevel,
        factors: result.factors as object,
        lastCalculatedAt: new Date(),
      },
    });

    // Notify if transitioning to HIGH or CRITICAL (and wasn't already)
    const isEscalating =
      (result.riskLevel === ChurnRisk.HIGH ||
        result.riskLevel === ChurnRisk.CRITICAL) &&
      prevRiskLevel !== result.riskLevel &&
      prevRiskLevel !== ChurnRisk.CRITICAL;

    if (isEscalating && this.notificationsService) {
      await this.notificationsService
        .create(userId, {
          type: NotificationType.CHURN_RISK,
          title: `Risque de désabonnement ${result.riskLevel === ChurnRisk.CRITICAL ? "CRITIQUE" : "ÉLEVÉ"}`,
          body: `Votre score d'engagement est de ${result.score}/100. Vérifiez l'activité de vos routeurs et renouvelez votre abonnement si nécessaire.`,
          data: { score: result.score, riskLevel: result.riskLevel },
        })
        .catch(() => {});
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Scoring engine
  // ---------------------------------------------------------------------------

  private async computeScore(userId: string): Promise<ChurnScoreResult> {
    const now = new Date();
    const d7ago = subDays(startOfDay(now), 7);
    const d14ago = subDays(startOfDay(now), 14);
    const d30ago = subDays(startOfDay(now), 30);
    const d60ago = subDays(startOfDay(now), 60);

    // Fetch operator's routers
    const routers = await this.prisma.router.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: { id: true, status: true },
    });

    const routerIds = routers.map((r) => r.id);

    // --- Factor 1: Inactivity (0–30 pts) ---
    const lastSession = await this.prisma.session.findFirst({
      where: { routerId: { in: routerIds } },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });

    const daysInactive = lastSession
      ? Math.floor((now.getTime() - lastSession.startedAt.getTime()) / 86400000)
      : 999;

    const inactivityScore =
      daysInactive <= 7
        ? 0
        : daysInactive <= 30
          ? Math.round(((daysInactive - 7) / 23) * 15)
          : 30;

    // --- Factor 2: Session trend (0–25 pts) ---
    const [sessLast7, sessPrev7] = await Promise.all([
      this.prisma.session.count({
        where: { routerId: { in: routerIds }, startedAt: { gte: d7ago } },
      }),
      this.prisma.session.count({
        where: {
          routerId: { in: routerIds },
          startedAt: { gte: d14ago, lt: d7ago },
        },
      }),
    ]);

    const sessionTrendPct =
      sessPrev7 > 0 ? ((sessLast7 - sessPrev7) / sessPrev7) * 100 : null;

    const sessionTrendScore =
      sessionTrendPct === null
        ? 0
        : sessionTrendPct >= 0
          ? 0
          : sessionTrendPct >= -20
            ? 5
            : sessionTrendPct >= -50
              ? 15
              : 25;

    // --- Factor 3: Subscription health (0–30 pts) ---
    const subscription = await this.prisma.operatorSubscription.findUnique({
      where: { userId },
      select: { status: true, endDate: true, autoRenew: true },
    });

    let subscriptionDaysLeft: number | null = null;
    let subscriptionScore = 0;

    if (
      !subscription ||
      subscription.status === SubscriptionStatus.EXPIRED ||
      subscription.status === SubscriptionStatus.CANCELLED
    ) {
      subscriptionScore = 30;
    } else {
      subscriptionDaysLeft = Math.floor(
        (subscription.endDate.getTime() - now.getTime()) / 86400000,
      );
      if (subscriptionDaysLeft < 0) {
        subscriptionScore = 30;
      } else if (!subscription.autoRenew && subscriptionDaysLeft < 7) {
        subscriptionScore = 25;
      } else if (!subscription.autoRenew) {
        subscriptionScore = 15;
      } else if (subscriptionDaysLeft < 3) {
        subscriptionScore = 10;
      }
    }

    // --- Factor 4: Revenue decline (0–15 pts) ---
    const [revLast30, revPrev30] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          voucher: { routerId: { in: routerIds } },
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: d30ago },
        },
        _sum: { amountXof: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          voucher: { routerId: { in: routerIds } },
          status: TransactionStatus.COMPLETED,
          paidAt: { gte: d60ago, lt: d30ago },
        },
        _sum: { amountXof: true },
      }),
    ]);

    const rev30 = revLast30._sum.amountXof ?? 0;
    const revPrev = revPrev30._sum.amountXof ?? 0;
    const revenueDeclinePct =
      revPrev > 0 ? ((rev30 - revPrev) / revPrev) * 100 : null;

    const revenueScore =
      revenueDeclinePct === null
        ? 0
        : revenueDeclinePct >= 0
          ? 0
          : revenueDeclinePct >= -20
            ? 5
            : revenueDeclinePct >= -50
              ? 10
              : 15;

    // --- Factor 5: Router health (0–10 pts) ---
    const offlineRouters = routers.filter(
      (r) => r.status === "OFFLINE" || r.status === "DEGRADED",
    ).length;
    const routerOfflinePct =
      routers.length > 0 ? (offlineRouters / routers.length) * 100 : 0;
    const routerHealthScore = Math.round((routerOfflinePct / 100) * 10);

    // --- Total ---
    const total = Math.min(
      100,
      inactivityScore +
        sessionTrendScore +
        subscriptionScore +
        revenueScore +
        routerHealthScore,
    );

    const riskLevel: ChurnRisk =
      total >= 75
        ? ChurnRisk.CRITICAL
        : total >= 50
          ? ChurnRisk.HIGH
          : total >= 25
            ? ChurnRisk.MEDIUM
            : ChurnRisk.LOW;

    const factors: ChurnFactors = {
      daysInactive,
      sessionTrendPct: sessionTrendPct ?? null,
      subscriptionDaysLeft,
      revenueDeclinePct: revenueDeclinePct ?? null,
      routerOfflinePct,
      scores: {
        inactivity: inactivityScore,
        sessionTrend: sessionTrendScore,
        subscription: subscriptionScore,
        revenue: revenueScore,
        routerHealth: routerHealthScore,
      },
    };

    return { userId, score: total, riskLevel, factors };
  }
}
