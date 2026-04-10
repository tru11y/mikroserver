import { Injectable, Logger, OnModuleDestroy, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationType, UserRole, Prisma } from "@prisma/client";
import { Subject, Observable } from "rxjs";
import * as webpush from "web-push";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { EmailService } from "./email.service";

export interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  routerId?: string;
  sessionId?: string;
}

@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly streams = new Map<string, Subject<MessageEvent>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Optional() private readonly emailService?: EmailService,
  ) {
    const vapidPublic = this.configService.get<string>("VAPID_PUBLIC_KEY");
    const vapidPrivate = this.configService.get<string>("VAPID_PRIVATE_KEY");
    const vapidEmail = this.configService.get<string>(
      "VAPID_EMAIL",
      "mailto:admin@mikroserver.ci",
    );

    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(vapidEmail!, vapidPublic, vapidPrivate);
    }
  }

  onModuleDestroy() {
    for (const subject of this.streams.values()) {
      subject.complete();
    }
    this.streams.clear();
  }

  getStream(userId: string): Observable<MessageEvent> {
    if (!this.streams.has(userId)) {
      this.streams.set(userId, new Subject<MessageEvent>());
    }
    return this.streams.get(userId)!.asObservable();
  }

  private pushToStream(userId: string, event: MessageEvent) {
    const subject = this.streams.get(userId);
    if (subject && !subject.closed) {
      subject.next(event);
    }
  }

  async create(userId: string, payload: NotificationPayload) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          data: (payload.data ?? {}) as Prisma.InputJsonValue,
          routerId: payload.routerId,
          sessionId: payload.sessionId,
        },
      });

      // Push to SSE stream if user is connected
      this.pushToStream(userId, {
        data: JSON.stringify({
          id: notification.id,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
          routerId: payload.routerId,
          sessionId: payload.sessionId,
          createdAt: notification.createdAt,
        }),
        id: notification.id,
        type: "notification",
      });

      // Web Push in background
      this.sendWebPush(userId, payload.title, payload.body, payload.data).catch(
        (err) =>
          this.logger.warn(
            `Web push failed for user ${userId}: ${String(err)}`,
          ),
      );

      return notification;
    } catch (error) {
      this.logger.error(`Failed to create notification: ${String(error)}`);
    }
  }

  async notifyRouterOwner(routerId: string, payload: NotificationPayload) {
    const router = await this.prisma.router.findUnique({
      where: { id: routerId, deletedAt: null },
      select: { ownerId: true, name: true },
    });

    if (!router?.ownerId) {
      // No owner set — notify all admins
      return this.notifyAllAdmins({ ...payload, routerId });
    }

    // Send email alert for router offline events
    if (payload.type === NotificationType.ROUTER_OFFLINE && this.emailService) {
      const owner = await this.prisma.user.findUnique({
        where: { id: router.ownerId },
        select: { email: true },
      });
      if (owner?.email) {
        this.emailService
          .sendRouterOffline(owner.email, router.name)
          .catch((err) =>
            this.logger.warn(
              `Router offline email failed for ${owner.email}: ${String(err)}`,
            ),
          );
      }
    }

    return this.create(router.ownerId, { ...payload, routerId });
  }

  async notifyAllAdmins(payload: NotificationPayload) {
    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
        deletedAt: null,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    await Promise.allSettled(
      admins.map((admin) => this.create(admin.id, payload)),
    );
  }

  async findAll(userId: string, page = 1, limit = 20, unreadOnly = false) {
    const skip = (Math.max(1, page) - 1) * Math.min(limit, 50);
    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: Math.min(limit, 50),
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { items, total, unreadCount, page, limit };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async registerPushSubscription(
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    userAgent?: string,
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh, auth, userAgent },
      create: { userId, endpoint, p256dh, auth, userAgent },
    });
  }

  async removePushSubscription(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  async sendWebPush(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    const payload = JSON.stringify({ title, body, data: data ?? {} });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          // 410 Gone = subscription expired, remove it
          if (statusCode === 410 || statusCode === 404) {
            await this.prisma.pushSubscription.deleteMany({
              where: { endpoint: sub.endpoint },
            });
          }
        }
      }),
    );
  }

  @Cron("0 7 * * *") // 7am daily
  async sendDailySummaries() {
    if (!this.emailService) return;

    try {
      const admins = await this.prisma.user.findMany({
        where: {
          role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
          deletedAt: null,
          status: "ACTIVE",
        },
        select: { id: true, email: true },
      });

      for (const admin of admins) {
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const [
            revenueResult,
            newSessions,
            newCustomers,
            routersOnline,
            routersTotal,
          ] = await Promise.all([
            this.prisma.transaction.aggregate({
              where: {
                createdAt: { gte: today },
                status: "COMPLETED",
                voucher: { router: { ownerId: admin.id } },
              },
              _sum: { amountXof: true },
            }),
            this.prisma.session.count({
              where: {
                createdAt: { gte: today },
                router: { ownerId: admin.id },
              },
            }),
            this.prisma.customerProfile.count({
              where: {
                firstSeenAt: { gte: today },
                router: { ownerId: admin.id },
              },
            }),
            this.prisma.router.count({
              where: { ownerId: admin.id, status: "ONLINE", deletedAt: null },
            }),
            this.prisma.router.count({
              where: { ownerId: admin.id, deletedAt: null },
            }),
          ]);

          await this.emailService.sendDailySummary(admin.email, {
            date: today.toLocaleDateString("fr-FR"),
            revenueXof: revenueResult._sum.amountXof ?? 0,
            newSessions,
            newCustomers,
            routersOnline,
            routersTotal,
          });
        } catch (err) {
          this.logger.error(
            `Daily summary email failed for admin ${admin.id}: ${String(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`sendDailySummaries cron failed: ${String(err)}`);
    }
  }
}
