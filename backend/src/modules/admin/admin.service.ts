import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  SubscriptionStatus,
  TenantStatus,
  UserStatus,
  UserRole,
} from "@prisma/client";
import { toTierDto, TierDto } from "../saas/tier.mapper";
import { UpdateTierDto } from "./dto/admin.dto";

const DEFAULT_PAGE_LIMIT = 25;

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  const n = Number(cursor);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Platform metrics
  // ---------------------------------------------------------------------------

  async getMetrics() {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      tenantsTotal,
      tenantsSuspended,
      subsActive,
      subsTrialing,
      trialsExpiringSoon,
      pendingInvoices,
      routersTotal,
      routersOnline,
      vouchersGenerated30d,
      vouchersActivated30d,
      mrrAgg,
    ] = await Promise.all([
      this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.tenant.count({
        where: { deletedAt: null, status: TenantStatus.SUSPENDED },
      }),
      this.prisma.operatorSubscription.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.prisma.operatorSubscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          trialEndsAt: { gt: now },
        },
      }),
      this.prisma.operatorSubscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          endDate: { gte: now, lte: sevenDaysFromNow },
        },
      }),
      this.prisma.invoice.count({ where: { status: "SENT" } }),
      this.prisma.router.count({ where: { deletedAt: null } }),
      this.prisma.router.count({
        where: { deletedAt: null, status: "ONLINE" },
      }),
      this.prisma.voucher.count({
        where: { generatedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.voucher.count({
        where: { activatedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.operatorSubscription.findMany({
        where: { status: SubscriptionStatus.ACTIVE },
        select: { priceXof: true, billingCycle: true },
      }),
    ]);

    const mrrXof = mrrAgg.reduce(
      (sum, s) =>
        sum + (s.billingCycle === "YEARLY" ? Math.round(s.priceXof / 12) : s.priceXof),
      0,
    );

    const tenantsLocked = await this.prisma.tenant.count({
      where: {
        deletedAt: null,
        status: TenantStatus.ACTIVE,
        users: {
          none: {
            operatorSubscription: {
              status: SubscriptionStatus.ACTIVE,
              endDate: { gte: now },
            },
          },
        },
      },
    });

    return {
      tenants: {
        total: tenantsTotal,
        pro: subsActive,
        trialing: subsTrialing,
        suspended: tenantsSuspended,
        locked: tenantsLocked,
      },
      revenue: { mrrXof, currency: "XOF", untieredActive: 0 },
      trialsExpiringIn7Days: trialsExpiringSoon,
      pendingInvoices,
      routers: { total: routersTotal, online: routersOnline },
      vouchers30d: {
        generated: vouchersGenerated30d,
        activated: vouchersActivated30d,
      },
      generatedAt: now.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Tenants
  // ---------------------------------------------------------------------------

  async listTenants(params: { q?: string; cursor?: string; limit?: number }) {
    const limit = Math.min(params.limit ?? DEFAULT_PAGE_LIMIT, 100);
    const skip = decodeCursor(params.cursor);

    const where = {
      deletedAt: null,
      ...(params.q
        ? { name: { contains: params.q, mode: "insensitive" as const } }
        : {}),
    };

    const tenants = await this.prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit + 1,
      include: {
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            operatorSubscription: { include: { tier: true } },
            _count: { select: { routersOwned: true } },
          },
        },
      },
    });

    const hasMore = tenants.length > limit;
    const page = tenants.slice(0, limit);

    const items = page.map((t) => {
      const owner = t.users.find((u) => u.operatorSubscription) ?? t.users[0];
      const sub = owner?.operatorSubscription;
      const userCount = t.users.length;
      const routerCount = t.users.reduce(
        (n, u) => n + u._count.routersOwned,
        0,
      );

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        plan: (sub && !sub.tier.isFree ? "PRO" : "FREE") as "FREE" | "PRO",
        subscriptionStatus: sub ? String(sub.status) : null,
        tierKey: sub?.tier.slug ?? null,
        tierName: sub?.tier.name ?? null,
        currentPeriodEnd: sub?.endDate.toISOString() ?? null,
        userCount,
        routerCount,
      };
    });

    return {
      items,
      nextCursor: hasMore ? String(skip + limit) : null,
    };
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          where: { deletedAt: null },
          include: {
            operatorSubscription: { include: { tier: true } },
            invoices: { orderBy: { createdAt: "desc" }, take: 20 },
            _count: { select: { routersOwned: true } },
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException("Tenant introuvable");

    const owner =
      tenant.users.find((u) => u.operatorSubscription) ?? tenant.users[0];
    const sub = owner?.operatorSubscription;
    const routerCount = tenant.users.reduce(
      (n, u) => n + u._count.routersOwned,
      0,
    );

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      createdAt: tenant.createdAt.toISOString(),
      subscription: sub
        ? {
            plan: (sub.tier.isFree ? "FREE" : "PRO") as "FREE" | "PRO",
            status: String(sub.status),
            billingPeriod: (sub.billingCycle === "YEARLY"
              ? "ANNUAL"
              : "MONTHLY") as "MONTHLY" | "ANNUAL",
            currentPeriodStart: sub.startDate.toISOString(),
            currentPeriodEnd: sub.endDate.toISOString(),
            tier: {
              key: sub.tier.slug,
              name: sub.tier.name,
              monthlyXof: sub.tier.priceXofMonthly,
            },
          }
        : null,
      users: tenant.users.map((u) => ({
        id: u.id,
        email: u.email,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || null,
        role: u.role,
        status: u.status,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
      _count: { routers: routerCount },
      invoices: (owner?.invoices ?? []).map((inv) => ({
        id: inv.id,
        amount: inv.totalXof,
        currency: "XOF",
        status: inv.status,
        billingPeriod: (inv.metadata as { billingPeriod?: string } | null)
          ?.billingPeriod === "ANNUAL"
          ? "ANNUAL"
          : ("MONTHLY" as "MONTHLY" | "ANNUAL"),
        note: inv.notes,
        createdAt: inv.createdAt.toISOString(),
        paidAt: inv.paidAt?.toISOString() ?? null,
        tier: (inv.metadata as { tierKey?: string; tierName?: string } | null)
          ?.tierKey
          ? {
              key: (inv.metadata as { tierKey: string }).tierKey,
              name: (inv.metadata as { tierName: string }).tierName,
            }
          : null,
      })),
    };
  }

  async setTenantStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status: status as TenantStatus },
      select: { id: true, name: true, status: true },
    });
    return tenant;
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  async listUsers(params: {
    q?: string;
    tenantId?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit ?? DEFAULT_PAGE_LIMIT, 100);
    const skip = decodeCursor(params.cursor);

    const where = {
      deletedAt: null,
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.q
        ? { email: { contains: params.q, mode: "insensitive" as const } }
        : {}),
    };

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit + 1,
      include: { tenant: { select: { id: true, name: true } } },
    });

    const hasMore = users.length > limit;
    const page = users.slice(0, limit);

    return {
      items: page.map((u) => ({
        id: u.id,
        email: u.email,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || null,
        role: u.role,
        status: u.status,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        tenantId: u.tenant?.id ?? "",
        tenantName: u.tenant?.name ?? "",
      })),
      nextCursor: hasMore ? String(skip + limit) : null,
    };
  }

  async setUserStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status: status as UserStatus },
      select: { id: true, email: true, status: true },
    });
    return user;
  }

  // ---------------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------------

  async listInvoices(params: {
    status?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit ?? DEFAULT_PAGE_LIMIT, 100);
    const skip = decodeCursor(params.cursor);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        type: "PLATFORM_FEE",
        ...(params.status ? { status: params.status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit + 1,
      include: { user: { include: { tenant: true } } },
    });

    const hasMore = invoices.length > limit;
    const page = invoices.slice(0, limit);

    return {
      items: page.map((inv) => {
        const meta = (inv.metadata ?? {}) as {
          billingPeriod?: string;
          periodDays?: number;
          tierKey?: string;
          tierName?: string;
        };
        return {
          id: inv.id,
          tenantId: inv.user.tenant?.id ?? "",
          tenantName: inv.user.tenant?.name ?? "",
          amount: inv.totalXof,
          currency: "XOF",
          status: inv.status,
          billingPeriod: (meta.billingPeriod === "ANNUAL"
            ? "ANNUAL"
            : "MONTHLY") as "MONTHLY" | "ANNUAL",
          periodDays: meta.periodDays ?? 30,
          note: inv.notes,
          tierKey: meta.tierKey ?? null,
          tierName: meta.tierName ?? null,
          createdAt: inv.createdAt.toISOString(),
          paidAt: inv.paidAt?.toISOString() ?? null,
        };
      }),
      nextCursor: hasMore ? String(skip + limit) : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Tiers
  // ---------------------------------------------------------------------------

  async listTiers(): Promise<TierDto[]> {
    const tiers = await this.prisma.saasTier.findMany({
      orderBy: { displayOrder: "asc" },
    });
    return tiers.map(toTierDto);
  }

  async updateTier(id: string, patch: UpdateTierDto): Promise<TierDto> {
    const tier = await this.prisma.saasTier.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.monthlyXof !== undefined
          ? { priceXofMonthly: patch.monthlyXof }
          : {}),
        ...(patch.routerLimit !== undefined
          ? { maxRouters: patch.routerLimit }
          : {}),
        ...(patch.displayOrder !== undefined
          ? { displayOrder: patch.displayOrder }
          : {}),
        ...(patch.active !== undefined ? { isActive: patch.active } : {}),
        ...(patch.tagline !== undefined ? { description: patch.tagline } : {}),
      },
    });
    return toTierDto(tier);
  }

  // ---------------------------------------------------------------------------
  // Audit
  // ---------------------------------------------------------------------------

  async listAudit(params: {
    tenantId?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit ?? DEFAULT_PAGE_LIMIT, 100);
    const skip = decodeCursor(params.cursor);

    const logs = await this.prisma.auditLog.findMany({
      where: params.tenantId
        ? { user: { tenantId: params.tenantId } }
        : {},
      orderBy: { createdAt: "desc" },
      skip,
      take: limit + 1,
      include: { user: { include: { tenant: true } } },
    });

    const hasMore = logs.length > limit;
    const page = logs.slice(0, limit);

    return {
      items: page.map((log) => ({
        id: log.id,
        tenantId: log.user?.tenant?.id ?? "",
        tenantName: log.user?.tenant?.name ?? "",
        userId: log.userId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.newValues,
        ip: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? String(skip + limit) : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Subscription activation (SUPER_ADMIN)
  // ---------------------------------------------------------------------------

  async activateTenantSubscription(tenantId: string, periodDays: number) {
    const owner = await this.getTenantOwner(tenantId);
    const now = new Date();
    const endDate = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    const pendingInvoice = await this.prisma.invoice.findFirst({
      where: { userId: owner.id, type: "PLATFORM_FEE", status: "SENT" },
      orderBy: { createdAt: "desc" },
    });
    const meta = (pendingInvoice?.metadata ?? {}) as { tierKey?: string };

    const tier = meta.tierKey
      ? await this.prisma.saasTier.findUnique({ where: { slug: meta.tierKey } })
      : await this.prisma.saasTier.findFirst({
          where: { isFree: false, isActive: true },
          orderBy: { displayOrder: "asc" },
        });
    if (!tier) throw new NotFoundException("Aucun tier SaaS disponible");

    const sub = await this.prisma.operatorSubscription.upsert({
      where: { userId: owner.id },
      update: {
        tierId: tier.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
        endDate,
        cancelledAt: null,
      },
      create: {
        userId: owner.id,
        tierId: tier.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
        endDate,
        priceXof: tier.priceXofMonthly,
      },
      include: { tier: true },
    });

    if (pendingInvoice) {
      await this.prisma.invoice.update({
        where: { id: pendingInvoice.id },
        data: { status: "PAID", paidAt: now },
      });
    }

    return this.tenantSubscriptionDto(sub);
  }

  async deactivateTenantSubscription(tenantId: string) {
    const owner = await this.getTenantOwner(tenantId);
    const sub = await this.prisma.operatorSubscription.update({
      where: { userId: owner.id },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
      include: { tier: true },
    });
    return this.tenantSubscriptionDto(sub);
  }

  private tenantSubscriptionDto(sub: {
    status: SubscriptionStatus;
    startDate: Date;
    endDate: Date;
    updatedAt: Date;
    tier: { isFree: boolean };
  }) {
    return {
      plan: (sub.tier.isFree ? "FREE" : "PRO") as "FREE" | "PRO",
      status: String(sub.status),
      currentPeriodStart: sub.startDate.toISOString(),
      currentPeriodEnd: sub.endDate.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    };
  }

  private async getTenantOwner(tenantId: string) {
    const owner = await this.prisma.user.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        role: { in: [UserRole.OWNER, UserRole.ADMIN] },
      },
      orderBy: { createdAt: "asc" },
    });
    if (!owner) throw new NotFoundException("Tenant sans propriétaire");
    return owner;
  }
}
