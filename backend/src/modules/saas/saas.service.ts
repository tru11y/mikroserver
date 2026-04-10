import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import {
  BillingCycle,
  NotificationType,
  SubscriptionStatus,
} from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { EmailService } from "../notifications/email.service";

const DEFAULT_TIERS = [
  {
    name: "Découverte",
    slug: "decouverte",
    description: "Commencez gratuitement avec un routeur",
    priceXofMonthly: 0,
    maxRouters: 1,
    maxMonthlyTx: 100,
    maxResellers: 0,
    features: [
      "1 routeur",
      "100 tickets/mois",
      "Analytics basiques",
      "Support communautaire",
    ],
    isFree: true,
    displayOrder: 1,
    trialDays: 0,
  },
  {
    name: "Entrepreneur",
    slug: "entrepreneur",
    description: "Pour les opérateurs en croissance",
    priceXofMonthly: 15000,
    priceXofYearly: 150000,
    maxRouters: 3,
    maxMonthlyTx: null,
    maxResellers: 2,
    features: [
      "3 routeurs",
      "Tickets illimités",
      "Analytics complets",
      "Notifications temps réel",
      "2 revendeurs",
      "Support email 48h",
    ],
    isFree: false,
    displayOrder: 2,
    trialDays: 14,
  },
  {
    name: "Pro",
    slug: "pro",
    description: "Pour les opérateurs établis",
    priceXofMonthly: 40000,
    priceXofYearly: 400000,
    maxRouters: 10,
    maxMonthlyTx: null,
    maxResellers: 10,
    features: [
      "10 routeurs",
      "Tickets illimités",
      "API Access",
      "White-label basique",
      "10 revendeurs",
      "Support prioritaire 24h",
      "Comptabilité avancée",
    ],
    isFree: false,
    displayOrder: 3,
    trialDays: 14,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    description: "Pour les grands opérateurs",
    priceXofMonthly: 100000,
    maxRouters: null,
    maxMonthlyTx: null,
    maxResellers: null,
    features: [
      "Routeurs illimités",
      "White-label complet",
      "SLA garanti",
      "Account manager dédié",
      "Formation sur site",
      "Intégration personnalisée",
    ],
    isFree: false,
    displayOrder: 4,
    trialDays: 30,
  },
];

@Injectable()
export class SaasService {
  private readonly logger = new Logger(SaasService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly emailService?: EmailService,
  ) {}

  async seedTiers() {
    for (const tier of DEFAULT_TIERS) {
      await this.prisma.saasTier.upsert({
        where: { slug: tier.slug },
        update: {},
        create: tier as Parameters<
          typeof this.prisma.saasTier.create
        >[0]["data"],
      });
    }
    this.logger.log("SaaS tiers seeded.");
  }

  @Cron("0 2 * * *") // Every day at 02:00
  async expireSubscriptions() {
    const now = new Date();

    // Mark expired subscriptions
    const expired = await this.prisma.operatorSubscription.updateMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { lt: now },
        autoRenew: false,
      },
      data: { status: SubscriptionStatus.EXPIRED },
    });

    // Find subscriptions expiring in 7 days for warnings
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSoon = await this.prisma.operatorSubscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { gte: now, lte: sevenDaysFromNow },
      },
      select: {
        userId: true,
        endDate: true,
        tier: { select: { name: true } },
        user: { select: { email: true } },
      },
    });

    // Notify each operator whose subscription expires soon
    for (const sub of expiringSoon) {
      const daysLeft = Math.ceil(
        (sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const tierName = (sub as { tier?: { name?: string } }).tier?.name ?? "";

      await this.notificationsService
        ?.create(sub.userId, {
          type: NotificationType.SUBSCRIPTION_EXPIRING,
          title: "Abonnement expirant bientôt",
          body: `Votre abonnement ${tierName} expire dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}. Renouvelez maintenant.`,
          data: { daysLeft },
        })
        .catch(() => {});

      // Also send an email alert
      const userEmail = (sub as { user?: { email?: string } }).user?.email;
      if (userEmail && this.emailService) {
        this.emailService
          .sendSubscriptionExpiring(userEmail, daysLeft, tierName)
          .catch((err) =>
            this.logger.warn(
              `Subscription expiring email failed for ${userEmail}: ${String(err)}`,
            ),
          );
      }
    }

    this.logger.log(
      `Subscriptions expired: ${expired.count}, expiring soon: ${expiringSoon.length}`,
    );
  }

  async findTiers() {
    return this.prisma.saasTier.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });
  }

  async getOperatorSubscription(userId: string) {
    return this.prisma.operatorSubscription.findUnique({
      where: { userId },
      include: { tier: true },
    });
  }

  async subscribe(
    userId: string,
    tierId: string,
    billingCycle: BillingCycle = BillingCycle.MONTHLY,
  ) {
    const tier = await this.prisma.saasTier.findUniqueOrThrow({
      where: { id: tierId },
    });
    const price =
      billingCycle === BillingCycle.YEARLY
        ? (tier.priceXofYearly ?? tier.priceXofMonthly * 10)
        : tier.priceXofMonthly;

    const months = billingCycle === BillingCycle.YEARLY ? 12 : 1;
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);

    const trialEndsAt =
      tier.trialDays > 0
        ? new Date(startDate.getTime() + tier.trialDays * 24 * 60 * 60 * 1000)
        : undefined;

    return this.prisma.operatorSubscription.upsert({
      where: { userId },
      update: {
        tierId,
        billingCycle,
        priceXof: price,
        startDate,
        endDate,
        status: SubscriptionStatus.ACTIVE,
        cancelledAt: null,
        trialEndsAt,
      },
      create: {
        userId,
        tierId,
        billingCycle,
        priceXof: price,
        startDate,
        endDate,
        trialEndsAt,
      },
      include: { tier: true },
    });
  }

  async cancel(userId: string, reason?: string) {
    return this.prisma.operatorSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });
  }

  async getUsage(userId: string): Promise<{
    routers: { current: number; limit: number | null };
    resellers: { current: number; limit: number | null };
    monthlyTx: { current: number; limit: number | null };
  }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const sub = await this.prisma.operatorSubscription.findUnique({
      where: { userId },
      include: { tier: true },
    });

    const [routerCount, resellerCount, txCount] = await Promise.all([
      this.prisma.router.count({ where: { deletedAt: null, ownerId: userId } }),
      this.prisma.resellerConfig.count({
        where: { parentId: userId, isActive: true },
      }),
      this.prisma.transaction.count({
        where: {
          status: "COMPLETED",
          createdAt: { gte: monthStart },
          voucher: { router: { ownerId: userId } },
        },
      }),
    ]);

    const routerLimit = sub?.tier.maxRouters ?? null;
    const resellerLimit = sub?.tier.maxResellers ?? null;
    const txLimit = sub?.tier.maxMonthlyTx ?? null;

    return {
      routers: { current: routerCount, limit: routerLimit },
      resellers: { current: resellerCount, limit: resellerLimit },
      monthlyTx: { current: txCount, limit: txLimit },
    };
  }

  async checkLimit(userId: string, limitType: "routers" | "resellers") {
    const sub = await this.prisma.operatorSubscription.findUnique({
      where: { userId },
      include: { tier: true },
    });

    if (!sub) return { allowed: true, limit: null, current: 0 };

    if (limitType === "routers") {
      const limit = sub.tier.maxRouters;
      if (!limit) return { allowed: true, limit: null, current: 0 };
      const current = await this.prisma.router.count({
        where: { deletedAt: null, ownerId: userId },
      });
      return { allowed: current < limit, limit, current };
    }

    if (limitType === "resellers") {
      const limit = sub.tier.maxResellers;
      if (!limit) return { allowed: true, limit: null, current: 0 };
      const current = await this.prisma.resellerConfig.count({
        where: { parentId: userId, isActive: true },
      });
      return { allowed: current < limit, limit, current };
    }

    return { allowed: true, limit: null, current: 0 };
  }
}
