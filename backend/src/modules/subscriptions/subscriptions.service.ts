import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, SubscriptionStatus, PaymentMethod } from "@prisma/client";
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  CancelSubscriptionDto,
  RenewSubscriptionDto,
} from "./dto/subscription.dto";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(userId: string, createSubscriptionDto: CreateSubscriptionDto) {
    const {
      planId,
      voucherId,
      startDate,
      endDate,
      autoRenew = true,
      priceXof,
      paymentMethod,
      nextBillingAt,
    } = createSubscriptionDto;

    // Validate plan exists
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${planId} not found`);
    }

    // Validate voucher if provided
    if (voucherId) {
      const voucher = await this.prisma.voucher.findUnique({
        where: { id: voucherId },
      });
      if (!voucher) {
        throw new NotFoundException(`Voucher with ID ${voucherId} not found`);
      }
      // Check if voucher is already linked to another subscription
      const existingSubscription = await this.prisma.subscriptions.findUnique({
        where: { voucher_id: voucherId },
      });
      if (existingSubscription) {
        throw new BadRequestException(
          `Voucher ${voucherId} is already linked to subscription ${existingSubscription.id}`,
        );
      }
    }

    const subscription = await this.prisma.subscriptions.create({
      data: {
        user_id: userId,
        plan_id: planId,
        voucher_id: voucherId,
        status: SubscriptionStatus.ACTIVE,
        start_date: new Date(startDate),
        end_date: new Date(endDate),
        auto_renew: autoRenew,
        price_xof: priceXof,
        payment_method: paymentMethod,
        next_billing_at: nextBillingAt ? new Date(nextBillingAt) : null,
        updated_at: new Date(),
      },
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            durationMinutes: true,
            priceXof: true,
          },
        },
        vouchers: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
    });

    // Update user's current subscription if this is the first/active one
    await this.prisma.user.update({
      where: { id: userId },
      data: { current_subscription_id: subscription.id },
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: "CREATE",
      entityType: "Subscription",
      entityId: subscription.id,
      newValues: subscription,
      description: `Created subscription ${subscription.id} for plan ${plan.name}`,
    });

    return subscription;
  }

  async findAll(
    userId: string,
    filters?: {
      status?: SubscriptionStatus;
      planId?: string;
      voucherId?: string;
      activeOnly?: boolean;
    },
  ) {
    const where: Prisma.subscriptionsWhereInput = { user_id: userId };

    if (filters?.status) where.status = filters.status;
    if (filters?.planId) where.plan_id = filters.planId;
    if (filters?.voucherId) where.voucher_id = filters.voucherId;
    if (filters?.activeOnly) {
      where.status = SubscriptionStatus.ACTIVE;
      where.end_date = { gte: new Date() };
    }

    return this.prisma.subscriptions.findMany({
      where,
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            durationMinutes: true,
            priceXof: true,
          },
        },
        vouchers: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  async findOne(userId: string, id: string) {
    const subscription = await this.prisma.subscriptions.findUnique({
      where: { id },
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            durationMinutes: true,
            priceXof: true,
          },
        },
        vouchers: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    // Authorization: user can only access their own subscriptions (except admins)
    if (subscription.user_id !== userId) {
      // Check if user is admin (you might want to inject user role from context)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
        throw new ForbiddenException(
          "You do not have permission to access this subscription",
        );
      }
    }

    return subscription;
  }

  async update(
    userId: string,
    id: string,
    updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    const subscription = await this.findOne(userId, id);

    const updated = await this.prisma.subscriptions.update({
      where: { id },
      data: {
        status: updateSubscriptionDto.status,
        auto_renew: updateSubscriptionDto.autoRenew,
        next_billing_at: updateSubscriptionDto.nextBillingAt
          ? new Date(updateSubscriptionDto.nextBillingAt)
          : undefined,
        cancellation_reason: updateSubscriptionDto.cancellationReason,
        payment_method: updateSubscriptionDto.paymentMethod,
        cancelled_at:
          updateSubscriptionDto.status === SubscriptionStatus.CANCELLED
            ? new Date()
            : undefined,
      },
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            durationMinutes: true,
            priceXof: true,
          },
        },
        vouchers: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
    });

    // If subscription is cancelled, clear user's current subscription if it's this one
    if (updateSubscriptionDto.status === SubscriptionStatus.CANCELLED) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { current_subscription_id: true },
      });
      if (user?.current_subscription_id === id) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { current_subscription_id: null },
        });
      }
    }

    await this.auditService.log({
      userId,
      action: "UPDATE",
      entityType: "Subscription",
      entityId: id,
      oldValues: subscription,
      newValues: updated,
      description: `Updated subscription ${id}`,
    });

    return updated;
  }

  async cancel(userId: string, id: string, cancelDto: CancelSubscriptionDto) {
    const subscription = await this.findOne(userId, id);

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException(`Subscription ${id} is already cancelled`);
    }

    const updated = await this.prisma.subscriptions.update({
      where: { id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelled_at: new Date(),
        cancellation_reason: cancelDto.reason || "User requested cancellation",
      },
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            durationMinutes: true,
            priceXof: true,
          },
        },
        vouchers: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
    });

    // Clear user's current subscription if it's this one
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { current_subscription_id: true },
    });
    if (user?.current_subscription_id === id) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { current_subscription_id: null },
      });
    }

    await this.auditService.log({
      userId,
      action: "UPDATE",
      entityType: "Subscription",
      entityId: id,
      oldValues: subscription,
      newValues: updated,
      description: `Cancelled subscription ${id}: ${cancelDto.reason || "No reason provided"}`,
    });

    return updated;
  }

  async renew(userId: string, id: string, renewDto: RenewSubscriptionDto) {
    const subscription = await this.findOne(userId, id);

    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.PENDING
    ) {
      throw new BadRequestException(
        `Subscription ${id} cannot be renewed because it's ${subscription.status}`,
      );
    }

    const newEndDate = renewDto.newEndDate
      ? new Date(renewDto.newEndDate)
      : new Date(subscription.end_date);
    const newPriceXof = renewDto.newPriceXof ?? subscription.price_xof;

    // Ensure new end date is after current end date
    if (newEndDate <= subscription.end_date) {
      throw new BadRequestException(
        "New end date must be after current end date",
      );
    }

    const updated = await this.prisma.subscriptions.update({
      where: { id },
      data: {
        end_date: newEndDate,
        price_xof: newPriceXof,
        last_billed_at: new Date(),
        next_billing_at: renewDto.newEndDate
          ? new Date(renewDto.newEndDate)
          : undefined,
      },
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            durationMinutes: true,
            priceXof: true,
          },
        },
        vouchers: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
    });

    await this.auditService.log({
      userId,
      action: "UPDATE",
      entityType: "Subscription",
      entityId: id,
      oldValues: subscription,
      newValues: updated,
      description: `Renewed subscription ${id} until ${newEndDate.toISOString()}`,
    });

    return updated;
  }

  async remove(userId: string, id: string) {
    const subscription = await this.findOne(userId, id);

    // Soft delete not supported in schema; we'll just cancel
    const updated = await this.prisma.subscriptions.update({
      where: { id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelled_at: new Date(),
        cancellation_reason: "Deleted by user",
      },
    });

    await this.auditService.log({
      userId,
      action: "DELETE",
      entityType: "Subscription",
      entityId: id,
      oldValues: subscription,
      description: `Deleted subscription ${id}`,
    });

    return updated;
  }

  async getCurrentSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions_users_current_subscription_idTosubscriptions: {
          include: {
            plans: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                durationMinutes: true,
                priceXof: true,
              },
            },
            vouchers: {
              select: {
                id: true,
                code: true,
                status: true,
              },
            },
          },
        },
      },
    });

    return (
      user?.subscriptions_users_current_subscription_idTosubscriptions || null
    );
  }

  async findExpiringSoon(days: number = 7) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);

    return this.prisma.subscriptions.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        end_date: {
          lte: threshold,
          gte: new Date(),
        },
        auto_renew: true,
      },
      include: {
        users_subscriptions_user_idTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        plans: {
          select: {
            id: true,
            name: true,
            slug: true,
            priceXof: true,
          },
        },
      },
      orderBy: { end_date: "asc" },
    });
  }
}
