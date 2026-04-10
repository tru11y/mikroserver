import {
  Injectable,
  Logger,
  Optional,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { RouterApiService } from "../routers/router-api.service";
import { SessionStatus, NotificationType, UserRole } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { CustomersService } from "../customers/customers.service";
import { scopeToOwner } from "../../common/helpers/tenant-scope.helper";

export interface ActiveSessionView {
  id: string;
  routerId: string;
  routerName: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
}

export interface SessionRouterError {
  routerId: string;
  routerName: string;
  error: string;
}

export interface ActiveSessionsResponse {
  items: ActiveSessionView[];
  routerErrors: SessionRouterError[];
  totalRouters: number;
  respondingRouters: number;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly notifiedSessionIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly routerApiService: RouterApiService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly customersService?: CustomersService,
  ) {}

  async findActive(
    routerId?: string,
    actor?: { sub: string; role: UserRole },
  ): Promise<ActiveSessionsResponse> {
    const ownerScope = actor ? scopeToOwner(actor.sub, actor.role) : {};
    const routers = await this.prisma.router.findMany({
      where: {
        deletedAt: null,
        ...ownerScope,
        ...(routerId ? { id: routerId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const statsResults = await Promise.allSettled(
      routers.map(async (router) => {
        const stats = await this.routerApiService.getLiveStats(router.id);
        return stats.clients.map<ActiveSessionView>((client) => ({
          id: client.id,
          routerId: router.id,
          routerName: router.name,
          username: client.username,
          ipAddress: client.ipAddress,
          macAddress: client.macAddress,
          uptime: client.uptime,
          bytesIn: client.bytesIn,
          bytesOut: client.bytesOut,
        }));
      }),
    );

    const items = statsResults
      .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      .sort((a, b) => b.bytesIn - a.bytesIn);

    const routerErrors = statsResults.flatMap((result, index) => {
      if (result.status === "fulfilled") {
        return [];
      }

      const router = routers[index];
      const reason =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      return [
        {
          routerId: router.id,
          routerName: router.name,
          error: reason,
        },
      ];
    });

    return {
      items,
      routerErrors,
      totalRouters: routers.length,
      respondingRouters: routers.length - routerErrors.length,
    };
  }

  async findByMac(macAddress: string, routerId?: string) {
    return this.prisma.session.findMany({
      where: {
        macAddress,
        ...(routerId ? { routerId } : {}),
        status: SessionStatus.ACTIVE,
      },
      include: {
        router: { select: { id: true, name: true } },
        voucher: { select: { code: true, plan: { select: { name: true } } } },
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
  }

  async terminate(routerId: string, mikrotikId: string) {
    await this.routerApiService.disconnectActiveSession(routerId, mikrotikId);
    await this.prisma.session.updateMany({
      where: {
        routerId,
        mikrotikId,
        status: SessionStatus.ACTIVE,
      },
      data: {
        status: SessionStatus.TERMINATED,
        terminatedAt: new Date(),
        terminateReason: "manual_termination",
      },
    });

    // Notify router owner about terminated session
    if (this.notificationsService) {
      await this.notificationsService
        .notifyRouterOwner(routerId, {
          type: NotificationType.SESSION_EXPIRED,
          title: "Session terminée",
          body: `Une session a été terminée manuellement sur ce routeur.`,
          data: { routerId, mikrotikId },
          routerId,
        })
        .catch(() => {});
    }

    return { success: true };
  }

  async forceDisconnect(
    sessionId: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ): Promise<{ success: true }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        router: { select: { id: true, name: true, ownerId: true } },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} introuvable`);
    }

    // ADMIN can only disconnect sessions on their own routers
    if (
      requestingUserRole === UserRole.ADMIN &&
      session.router.ownerId !== requestingUserId
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez déconnecter que les sessions de vos propres routeurs",
      );
    }

    // Best-effort: disconnect on router if we have a mikrotikId
    if (session.mikrotikId) {
      try {
        await this.routerApiService.disconnectActiveSession(
          session.routerId,
          session.mikrotikId,
        );
      } catch {
        // Router may be offline — still mark session TERMINATED in DB
      }
    } else if (session.macAddress) {
      // No mikrotikId stored — try disconnecting by username via MAC lookup
      try {
        await this.routerApiService.disconnectActiveSessionsByUsername(
          session.routerId,
          session.macAddress,
        );
      } catch {
        // Best-effort — ignore errors
      }
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.TERMINATED,
        terminatedAt: new Date(),
        terminateReason: "force_disconnect",
      },
    });

    return { success: true };
  }

  @Cron("*/30 * * * * *") // Every 30 seconds
  async detectNewSessions() {
    if (!this.notificationsService) return;

    const cutoff = new Date(Date.now() - 90 * 1000); // 90 seconds window
    const newSessions = await this.prisma.session.findMany({
      where: {
        status: SessionStatus.ACTIVE,
        createdAt: { gte: cutoff },
      },
      include: {
        router: { select: { id: true, name: true, ownerId: true } },
        voucher: { select: { code: true, plan: { select: { name: true } } } },
      },
      take: 50,
    });

    for (const session of newSessions) {
      // Skip already-notified sessions to prevent duplicate notifications
      if (this.notifiedSessionIds.has(session.id)) continue;
      this.notifiedSessionIds.add(session.id);

      // Update customer profile
      if (session.macAddress && this.customersService) {
        await this.customersService
          .upsertFromSession(
            session.macAddress,
            session.routerId,
            session.voucher?.code ?? "unknown",
          )
          .catch(() => {});
      }

      // Notify router owner
      await this.notificationsService
        .notifyRouterOwner(session.routerId, {
          type: NotificationType.NEW_CONNECTION,
          title: "Nouvelle connexion WiFi",
          body: `Nouvelle session sur ${session.router.name}${session.macAddress ? ` · ${session.macAddress}` : ""}${session.voucher?.plan?.name ? ` · Plan: ${session.voucher.plan.name}` : ""}`,
          data: {
            sessionId: session.id,
            routerId: session.routerId,
            routerName: session.router.name,
            macAddress: session.macAddress,
            plan: session.voucher?.plan?.name,
          },
          routerId: session.routerId,
          sessionId: session.id,
        })
        .catch(() => {});
    }

    // Cleanup: remove IDs of terminated sessions to prevent memory leak
    if (this.notifiedSessionIds.size > 1000) {
      const activeIds = new Set(newSessions.map((s) => s.id));
      for (const id of this.notifiedSessionIds) {
        if (!activeIds.has(id)) this.notifiedSessionIds.delete(id);
      }
    }
  }

  async findHistory(params: {
    routerId?: string;
    macAddress?: string;
    status?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
    requestingUserId: string;
    requestingUserRole: UserRole;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(params.limit ?? 50, 100);
    const skip = (page - 1) * limit;
    const isSuperAdmin = params.requestingUserRole === UserRole.SUPER_ADMIN;

    const where: Record<string, unknown> = {
      ...(params.routerId ? { routerId: params.routerId } : {}),
      ...(params.macAddress ? { macAddress: params.macAddress } : {}),
      ...(params.status ? { status: params.status as SessionStatus } : {}),
      ...(params.from || params.to
        ? {
            startedAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
      ...(!isSuperAdmin
        ? { router: { ownerId: params.requestingUserId } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          macAddress: true,
          ipAddress: true,
          bytesIn: true,
          bytesOut: true,
          startedAt: true,
          lastSeenAt: true,
          terminatedAt: true,
          terminateReason: true,
          router: { select: { id: true, name: true } },
          voucher: {
            select: {
              code: true,
              status: true,
              activatedAt: true,
              expiresAt: true,
              generationType: true,
              plan: { select: { name: true, durationMinutes: true } },
            },
          },
        },
      }),
      this.prisma.session.count({ where }),
    ]);

    const now = new Date();
    const enriched = items.map((s) => {
      const endTime = s.terminatedAt ?? s.lastSeenAt ?? now;
      const durationMs = endTime.getTime() - s.startedAt.getTime();
      const durationMinutes = Math.max(0, Math.round(durationMs / 60000));
      const planDurationMinutes = s.voucher?.plan?.durationMinutes ?? null;
      const remainingMinutes =
        s.voucher?.expiresAt && s.status === "ACTIVE"
          ? Math.max(
              0,
              Math.ceil(
                (s.voucher.expiresAt.getTime() - now.getTime()) / 60000,
              ),
            )
          : null;

      return {
        ...s,
        durationMinutes,
        planDurationMinutes,
        remainingMinutes,
        isOverdue:
          s.status === "ACTIVE" &&
          s.voucher?.expiresAt != null &&
          s.voucher.expiresAt <= now,
      };
    });

    return { items: enriched, total, page, limit };
  }

  @Cron("0 3 * * *") // 3am daily
  async cleanupExpiredSessions() {
    // Mark as EXPIRED sessions that are ACTIVE but their voucher has expired
    const expired = await this.prisma.session.updateMany({
      where: {
        status: SessionStatus.ACTIVE,
        voucher: {
          expiresAt: { lt: new Date() },
        },
      },
      data: {
        status: SessionStatus.EXPIRED,
        terminatedAt: new Date(),
        terminateReason: "voucher_expired",
      },
    });

    // Also cleanup very old ACTIVE sessions (> 24h without update — likely stale)
    const stale = await this.prisma.session.updateMany({
      where: {
        status: SessionStatus.ACTIVE,
        updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      data: {
        status: SessionStatus.EXPIRED,
        terminatedAt: new Date(),
        terminateReason: "stale",
      },
    });

    this.logger.log(
      `Session cleanup: ${expired.count} expired, ${stale.count} stale`,
    );
  }
}
