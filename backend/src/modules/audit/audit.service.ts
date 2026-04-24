import { Injectable, Logger } from "@nestjs/common";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListAuditLogsQueryDto } from "./dto/audit.dto";

export interface AuditActor {
  sub: string;
  role: UserRole;
}

export interface AuditLogInput {
  userId?: string;
  auditedById?: string;
  routerId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  description?: string;
}

type AuditLogWithRelations = Prisma.AuditLogGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        email: true;
        role: true;
      };
    };
    router: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

const AUDIT_ACTIONS = Object.values(AuditAction);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId,
          auditedById: input.auditedById,
          routerId: input.routerId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          oldValues: input.oldValues as object | undefined,
          newValues: input.newValues as object | undefined,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          description: input.description,
        },
      });
    } catch (error) {
      // Audit logging must NEVER fail the main operation
      this.logger.error(`Failed to write audit log: ${String(error)}`, {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
      });
    }
  }

  async findLogs(query: ListAuditLogsQueryDto, actor?: AuditActor) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const where = this.buildWhere(query, actor);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayCount, actionCounts, logs, entityTypeRows] =
      await Promise.all([
        this.prisma.auditLog.count({ where }),
        this.prisma.auditLog.count({
          where: {
            ...where,
            createdAt: {
              ...(where.createdAt as Prisma.DateTimeFilter | undefined),
              gte:
                (where.createdAt as Prisma.DateTimeFilter | undefined)?.gte ??
                today,
            },
          },
        }),
        this.prisma.auditLog.groupBy({
          by: ["action"],
          where,
          _count: { _all: true },
        }),
        this.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
            router: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        this.prisma.auditLog.findMany({
          distinct: ["entityType"],
          where,
          select: { entityType: true },
          orderBy: { entityType: "asc" },
        }),
      ]);

    const entityLabelMap = await this.buildEntityLabelMap(logs);
    const countsByAction = new Map(
      actionCounts.map((item) => [item.action, item._count._all]),
    );

    return {
      summary: {
        total,
        today: todayCount,
        create: countsByAction.get(AuditAction.CREATE) ?? 0,
        update: countsByAction.get(AuditAction.UPDATE) ?? 0,
        delete: countsByAction.get(AuditAction.DELETE) ?? 0,
        security: countsByAction.get(AuditAction.SECURITY_ALERT) ?? 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      filters: {
        actions: AUDIT_ACTIONS,
        entityTypes: entityTypeRows.map((row) => row.entityType),
      },
      items: logs.map((log) => this.mapLog(log, entityLabelMap)),
    };
  }

  private buildWhere(
    query: ListAuditLogsQueryDto,
    actor?: AuditActor,
  ): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    // Tenant isolation: non-SUPER_ADMIN only sees their own logs
    if (actor && actor.role !== UserRole.SUPER_ADMIN) {
      where.AND = [
        {
          OR: [
            { userId: actor.sub },
            { router: { is: { ownerId: actor.sub } } },
          ],
        },
      ];
    }
    const createdAt: Prisma.DateTimeFilter = {};

    if (query.action) {
      where.action = query.action;
    }

    if (query.actorId) {
      where.userId = query.actorId;
    }

    if (query.routerId) {
      where.routerId = query.routerId;
    }

    if (query.entityId?.trim()) {
      where.entityId = query.entityId.trim();
    }

    if (query.entityType?.trim()) {
      where.entityType = {
        equals: query.entityType.trim(),
        mode: "insensitive",
      };
    }

    if (query.startDate) {
      createdAt.gte = new Date(`${query.startDate}T00:00:00.000Z`);
    }

    if (query.endDate) {
      createdAt.lte = new Date(`${query.endDate}T23:59:59.999Z`);
    }

    if (createdAt.gte || createdAt.lte) {
      where.createdAt = createdAt;
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          entityType: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          entityId: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          requestId: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          user: {
            is: {
              email: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          user: {
            is: {
              firstName: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          user: {
            is: {
              lastName: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          router: {
            is: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    return where;
  }

  private async buildEntityLabelMap(logs: AuditLogWithRelations[]) {
    const uniqueIdsByType = <T extends string>(
      entityType: string,
      mapper: (log: AuditLogWithRelations) => T | null | undefined = (log) =>
        log.entityId as T | null | undefined,
    ) =>
      Array.from(
        new Set(
          logs
            .filter((log) => log.entityType === entityType)
            .map(mapper)
            .filter((value): value is T => Boolean(value)),
        ),
      );

    const userIds = uniqueIdsByType<string>("User");
    const routerIds = uniqueIdsByType<string>("Router");
    const planIds = uniqueIdsByType<string>("Plan");
    const voucherIds = uniqueIdsByType<string>("Voucher");

    const [users, routers, plans, vouchers] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          })
        : Promise.resolve([]),
      routerIds.length
        ? this.prisma.router.findMany({
            where: { id: { in: routerIds } },
            select: {
              id: true,
              name: true,
            },
          })
        : Promise.resolve([]),
      planIds.length
        ? this.prisma.plan.findMany({
            where: { id: { in: planIds } },
            select: {
              id: true,
              name: true,
            },
          })
        : Promise.resolve([]),
      voucherIds.length
        ? this.prisma.voucher.findMany({
            where: { id: { in: voucherIds } },
            select: {
              id: true,
              code: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const entityLabels = new Map<string, string>();

    for (const user of users) {
      const fullName = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      entityLabels.set(
        `User:${user.id}`,
        fullName ? `${fullName} (${user.email})` : user.email,
      );
    }

    for (const router of routers) {
      entityLabels.set(`Router:${router.id}`, router.name);
    }

    for (const plan of plans) {
      entityLabels.set(`Plan:${plan.id}`, plan.name);
    }

    for (const voucher of vouchers) {
      entityLabels.set(`Voucher:${voucher.id}`, voucher.code);
    }

    return entityLabels;
  }

  private mapLog(
    log: AuditLogWithRelations,
    entityLabelMap: Map<string, string>,
  ) {
    const oldValues = this.asPlainObject(log.oldValues);
    const newValues = this.asPlainObject(log.newValues);
    const changeKeys = Array.from(
      new Set([...Object.keys(oldValues), ...Object.keys(newValues)]),
    ).slice(0, 10);

    const actorName = log.user
      ? [log.user.firstName, log.user.lastName].filter(Boolean).join(" ").trim()
      : null;

    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId ?? null,
      entityLabel:
        log.entityId && entityLabelMap.has(`${log.entityType}:${log.entityId}`)
          ? (entityLabelMap.get(`${log.entityType}:${log.entityId}`) ?? null)
          : null,
      description: log.description ?? null,
      createdAt: log.createdAt,
      ipAddress: log.ipAddress ?? null,
      userAgent: log.userAgent ?? null,
      requestId: log.requestId ?? null,
      actor: log.user
        ? {
            id: log.user.id,
            name: actorName || log.user.email,
            email: log.user.email,
            role: log.user.role,
          }
        : null,
      router: log.router
        ? {
            id: log.router.id,
            name: log.router.name,
          }
        : null,
      changeKeys,
      oldValues: log.oldValues ?? null,
      newValues: log.newValues ?? null,
    };
  }

  private asPlainObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
