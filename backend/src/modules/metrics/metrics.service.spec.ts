import { RouterStatus } from "@prisma/client";
import { MetricsService } from "./metrics.service";

describe("MetricsService incident center", () => {
  const createService = () => {
    const prisma = {
      router: {
        findMany: jest.fn(),
      },
      voucher: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      transaction: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: {
        count: jest.fn(),
      },
      subscriptions: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      plan: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      revenueSnapshot: {
        upsert: jest.fn(),
      },
      session: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const queueService = {
      getOperationalStats: jest.fn(),
    };

    const redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const service = new MetricsService(
      prisma as never,
      queueService as never,
      redis as never,
    );

    return { service, prisma, queueService };
  };

  it("builds operational incidents from routers, delivery failures and queue backlog", async () => {
    const { service, prisma, queueService } = createService();

    prisma.router.findMany.mockResolvedValue([
      {
        id: "router-offline",
        name: "Plateau",
        status: RouterStatus.OFFLINE,
        lastSeenAt: new Date("2026-03-14T08:00:00.000Z"),
        lastHeartbeatAt: null,
        metadata: {
          lastHealthCheckError: "wireguard timeout",
          lastSyncError: null,
          lastUnmatchedUsers: ["abc123", "def456"],
          lastSyncAt: "2026-03-14T07:59:00.000Z",
        },
      },
      {
        id: "router-online",
        name: "Cocody",
        status: RouterStatus.ONLINE,
        lastSeenAt: new Date(),
        lastHeartbeatAt: null,
        metadata: {
          lastSyncError: "sync failed",
          lastUnmatchedUsers: ["u1", "u2", "u3", "u4", "u5"],
          lastSyncAt: "2026-03-14T08:30:00.000Z",
        },
      },
    ]);

    prisma.voucher.count.mockResolvedValue(3);
    prisma.voucher.findMany.mockResolvedValue([
      {
        code: "FAIL-001",
        updatedAt: new Date("2026-03-14T08:15:00.000Z"),
        lastDeliveryError: "router auth failed",
        router: { id: "router-offline", name: "Plateau" },
      },
    ]);

    queueService.getOperationalStats.mockResolvedValue({
      voucherDelivery: {
        waiting: 6,
        active: 1,
        delayed: 0,
        failed: 2,
        paused: 0,
      },
      paymentWebhook: {
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        paused: 0,
      },
    });

    const result = await service.getIncidentCenter();

    expect(result.summary.offlineRouters).toBe(1);
    expect(result.summary.routersWithSyncErrors).toBe(1);
    expect(result.summary.routersWithUnmatchedUsers).toBe(2);
    expect(result.summary.deliveryFailures).toBe(3);
    expect(result.summary.voucherQueueBacklog).toBe(6);
    expect(
      result.incidents.some((incident) => incident.type === "ROUTER_OFFLINE"),
    ).toBe(true);
    expect(
      result.incidents.some(
        (incident) => incident.type === "ROUTER_SYNC_ERROR",
      ),
    ).toBe(true);
    expect(
      result.incidents.some(
        (incident) => incident.type === "DELIVERY_FAILURES",
      ),
    ).toBe(true);
    expect(
      result.incidents.some((incident) => incident.type === "QUEUE_BACKLOG"),
    ).toBe(true);
  });

  it("returns a clean incident center when no operational issue is detected", async () => {
    const { service, prisma, queueService } = createService();

    prisma.router.findMany.mockResolvedValue([
      {
        id: "router-ok",
        name: "Marcory",
        status: RouterStatus.ONLINE,
        lastSeenAt: new Date(),
        lastHeartbeatAt: null,
        metadata: {
          lastSyncError: null,
          lastUnmatchedUsers: [],
        },
      },
    ]);
    prisma.voucher.count.mockResolvedValue(0);
    prisma.voucher.findMany.mockResolvedValue([]);
    queueService.getOperationalStats.mockResolvedValue({
      voucherDelivery: {
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        paused: 0,
      },
      paymentWebhook: {
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        paused: 0,
      },
    });

    const result = await service.getIncidentCenter();

    expect(result.summary.total).toBe(0);
    expect(result.summary.critical).toBe(0);
    expect(result.summary.high).toBe(0);
    expect(result.summary.medium).toBe(0);
    expect(result.summary.low).toBe(0);
    expect(result.incidents).toEqual([]);
  });

  it("builds a detailed ticket report with breakdowns and recent delivery failures", async () => {
    const { service, prisma } = createService();

    const voucherSelectResult = {
      routerId: "router-1",
      createdById: "user-1",
      planId: "plan-1",
      router: { id: "router-1", name: "Plateau", status: RouterStatus.ONLINE },
      createdBy: {
        id: "user-1",
        firstName: "Awa",
        lastName: "Traore",
        role: "RESELLER",
        email: "awa@example.com",
      },
      plan: { id: "plan-1", name: "1 Heure", priceXof: 300 },
    };

    prisma.voucher.findMany
      .mockResolvedValueOnce([
        {
          ...voucherSelectResult,
          id: "created-1",
          code: "AAA001",
          updatedAt: new Date("2026-03-14T08:00:00.000Z"),
          lastDeliveryError: null,
        },
        {
          ...voucherSelectResult,
          id: "created-2",
          code: "AAA002",
          updatedAt: new Date("2026-03-14T08:05:00.000Z"),
          lastDeliveryError: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          ...voucherSelectResult,
          id: "activated-1",
          code: "AAA001",
          updatedAt: new Date("2026-03-14T09:00:00.000Z"),
          lastDeliveryError: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          ...voucherSelectResult,
          id: "completed-1",
          code: "AAA001",
          updatedAt: new Date("2026-03-14T10:00:00.000Z"),
          lastDeliveryError: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          ...voucherSelectResult,
          id: "failed-1",
          code: "FAIL001",
          updatedAt: new Date("2026-03-14T10:10:00.000Z"),
          lastDeliveryError: "router auth failed",
        },
      ]);

    prisma.auditLog.count.mockResolvedValue(1);

    const report = await service.getTicketReport({
      startDate: "2026-03-14",
      endDate: "2026-03-14",
    });

    expect(report.summary.created).toBe(2);
    expect(report.summary.activated).toBe(1);
    expect(report.summary.completed).toBe(1);
    expect(report.summary.deleted).toBe(1);
    expect(report.summary.deliveryFailed).toBe(1);
    expect(report.summary.totalActivatedAmountXof).toBe(300);
    expect(report.breakdowns.routers[0]).toMatchObject({
      name: "Plateau",
      created: 2,
      activated: 1,
      completed: 1,
      deliveryFailed: 1,
      activatedAmountXof: 300,
    });
    expect(report.breakdowns.operators[0]).toMatchObject({
      name: "Awa Traore",
      secondaryLabel: "RESELLER",
    });
    expect(report.breakdowns.plans[0]).toMatchObject({
      name: "1 Heure",
      activatedAmountXof: 300,
    });
    expect(report.recentDeliveryFailures[0]).toMatchObject({
      code: "FAIL001",
      routerName: "Plateau",
      operatorName: "Awa Traore",
      error: "router auth failed",
    });
  });

  it("returns subscriptions today, expirations today and recurring rankings", async () => {
    const { service, prisma } = createService();

    const startedAt = new Date("2026-03-23T10:00:00.000Z");
    const endAt = new Date("2026-03-23T23:30:00.000Z");
    const startAt = new Date("2026-03-23T10:00:00.000Z");

    prisma.subscriptions.findMany
      .mockResolvedValueOnce([
        {
          id: "sub-1",
          user_id: "user-1",
          plan_id: "plan-1",
          status: "ACTIVE",
          auto_renew: true,
          price_xof: 2000,
          start_date: startAt,
          end_date: endAt,
          created_at: startedAt,
          users_subscriptions_user_idTousers: {
            id: "user-1",
            firstName: "Kouassi",
            lastName: "Yao",
            email: "kouassi@example.com",
          },
          plans: {
            id: "plan-1",
            name: "Pack 1H",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "sub-2",
          user_id: "user-2",
          plan_id: "plan-2",
          status: "ACTIVE",
          auto_renew: false,
          price_xof: 1500,
          start_date: new Date("2026-03-22T10:00:00.000Z"),
          end_date: new Date("2026-03-23T12:00:00.000Z"),
          created_at: new Date("2026-03-22T10:00:00.000Z"),
          users_subscriptions_user_idTousers: {
            id: "user-2",
            firstName: "Aminata",
            lastName: "Konate",
            email: "aminata@example.com",
          },
          plans: {
            id: "plan-2",
            name: "Pack 30min",
          },
        },
      ]);

    prisma.subscriptions.groupBy
      .mockResolvedValueOnce([
        {
          user_id: "user-1",
          _count: { _all: 4 },
          _sum: { price_xof: 9000 },
          _max: { created_at: new Date("2026-03-23T09:00:00.000Z") },
        },
      ])
      .mockResolvedValueOnce([
        {
          plan_id: "plan-1",
          _count: { _all: 6 },
          _sum: { price_xof: 12000 },
          _max: { created_at: new Date("2026-03-23T08:00:00.000Z") },
        },
      ]);

    prisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        firstName: "Kouassi",
        lastName: "Yao",
        email: "kouassi@example.com",
      },
    ]);

    prisma.plan.findMany.mockResolvedValue([
      {
        id: "plan-1",
        name: "Pack 1H",
      },
    ]);

    const started = await service.getSubscriptionsStartedToday();
    const expiring = await service.getSubscriptionsExpiringToday();
    const clients = await service.getTopRecurringClients(30, 5);
    const plans = await service.getTopRecurringPlans(30, 5);

    expect(started.count).toBe(1);
    expect(started.totalRevenueXof).toBe(2000);
    expect(started.items[0]).toMatchObject({
      id: "sub-1",
      customerName: "Kouassi Yao",
      planName: "Pack 1H",
      priceXof: 2000,
    });

    expect(expiring.count).toBe(1);
    expect(expiring.items[0]).toMatchObject({
      id: "sub-2",
      customerName: "Aminata Konate",
      planName: "Pack 30min",
    });

    expect(clients.items[0]).toMatchObject({
      userId: "user-1",
      customerName: "Kouassi Yao",
      subscriptionsCount: 4,
      totalSpentXof: 9000,
    });

    expect(plans.items[0]).toMatchObject({
      planId: "plan-1",
      planName: "Pack 1H",
      subscriptionsCount: 6,
      totalRevenueXof: 12000,
    });
  });
});
