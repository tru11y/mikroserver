import { AuditAction } from "@prisma/client";
import { AuditService } from "./audit.service";

describe("AuditService", () => {
  const createService = () => {
    const prisma = {
      auditLog: {
        create: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      router: {
        findMany: jest.fn(),
      },
      plan: {
        findMany: jest.fn(),
      },
      voucher: {
        findMany: jest.fn(),
      },
    };

    const service = new AuditService(prisma as never);

    return { prisma, service };
  };

  it("returns paginated logs with actor and entity labels", async () => {
    const { prisma, service } = createService();

    prisma.auditLog.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    prisma.auditLog.groupBy.mockResolvedValue([
      { action: AuditAction.CREATE, _count: { _all: 1 } },
      { action: AuditAction.UPDATE, _count: { _all: 1 } },
      { action: AuditAction.DELETE, _count: { _all: 1 } },
    ]);
    prisma.auditLog.findMany
      .mockResolvedValueOnce([
        {
          id: "audit-1",
          action: AuditAction.UPDATE,
          entityType: "Router",
          entityId: "router-entity",
          description: "Routeur Plateau passe en maintenance",
          oldValues: { status: "ONLINE" },
          newValues: { status: "MAINTENANCE" },
          ipAddress: "127.0.0.1",
          userAgent: "jest",
          requestId: "req-1",
          createdAt: new Date("2026-03-16T09:00:00.000Z"),
          user: {
            id: "actor-1",
            firstName: "Awa",
            lastName: "Traore",
            email: "awa@example.com",
            role: "ADMIN",
          },
          router: {
            id: "router-1",
            name: "Plateau",
          },
        },
      ])
      .mockResolvedValueOnce([
        { entityType: "Router" },
        { entityType: "User" },
      ]);

    prisma.user.findMany.mockResolvedValue([]);
    prisma.router.findMany.mockResolvedValue([
      {
        id: "router-entity",
        name: "Plateau",
      },
    ]);
    prisma.plan.findMany.mockResolvedValue([]);
    prisma.voucher.findMany.mockResolvedValue([]);

    const result = await service.findLogs({ page: 1, limit: 25 });

    expect(result.summary).toMatchObject({
      total: 3,
      today: 2,
      create: 1,
      update: 1,
      delete: 1,
      security: 0,
    });
    expect(result.pagination).toMatchObject({
      page: 1,
      limit: 25,
      total: 3,
      totalPages: 1,
    });
    expect(result.filters.actions).toContain(AuditAction.UPDATE);
    expect(result.filters.entityTypes).toEqual(["Router", "User"]);
    expect(result.items[0]).toMatchObject({
      id: "audit-1",
      entityType: "Router",
      entityLabel: "Plateau",
      actor: {
        id: "actor-1",
        name: "Awa Traore",
        email: "awa@example.com",
      },
      router: {
        id: "router-1",
        name: "Plateau",
      },
      changeKeys: ["status"],
    });
  });

  it("builds filters for action, entity, router, dates and search", async () => {
    const { prisma, service } = createService();

    prisma.auditLog.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prisma.auditLog.groupBy.mockResolvedValue([]);
    prisma.auditLog.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.router.findMany.mockResolvedValue([]);
    prisma.plan.findMany.mockResolvedValue([]);
    prisma.voucher.findMany.mockResolvedValue([]);

    await service.findLogs({
      page: 2,
      limit: 10,
      action: AuditAction.DELETE,
      entityType: "Voucher",
      entityId: "voucher-1",
      actorId: "11111111-1111-1111-1111-111111111111",
      routerId: "22222222-2222-2222-2222-222222222222",
      search: "plateau",
      startDate: "2026-03-15",
      endDate: "2026-03-16",
    });

    const firstWhere = prisma.auditLog.count.mock.calls[0][0].where;

    expect(firstWhere).toMatchObject({
      action: AuditAction.DELETE,
      userId: "11111111-1111-1111-1111-111111111111",
      routerId: "22222222-2222-2222-2222-222222222222",
      entityId: "voucher-1",
      entityType: {
        equals: "Voucher",
        mode: "insensitive",
      },
    });
    expect(firstWhere.createdAt.gte).toEqual(
      new Date("2026-03-15T00:00:00.000Z"),
    );
    expect(firstWhere.createdAt.lte).toEqual(
      new Date("2026-03-16T23:59:59.999Z"),
    );
    expect(firstWhere.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.objectContaining({
            contains: "plateau",
            mode: "insensitive",
          }),
        }),
        expect.objectContaining({
          router: {
            is: {
              name: expect.objectContaining({
                contains: "plateau",
                mode: "insensitive",
              }),
            },
          },
        }),
      ]),
    );
  });
});
