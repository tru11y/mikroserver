import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionStatus, UserRole } from "@prisma/client";

export const SKIP_SUBSCRIPTION_CHECK = "skipSubscriptionCheck";
export const SkipSubscriptionCheck = () =>
  Reflect.metadata(SKIP_SUBSCRIPTION_CHECK, true);

/**
 * Checks that the current operator has an active (non-expired) platform subscription.
 * SUPER_ADMIN is always allowed. Free tier (isFree=true) is always allowed.
 * Only applies when subscription exists and is expired/cancelled/suspended.
 */
@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_SUBSCRIPTION_CHECK,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { sub: string; role: string } }>();
    const user = request.user;
    if (!user) return true;

    // SUPER_ADMIN always passes
    if (user.role === UserRole.SUPER_ADMIN) return true;

    const sub = await this.prisma.operatorSubscription.findUnique({
      where: { userId: user.sub },
      include: { tier: { select: { isFree: true } } },
    });

    // No subscription = on free tier, always allowed
    if (!sub) return true;

    // Free tier = always allowed
    if (sub.tier.isFree) return true;

    // Check if subscription is active and not expired
    const now = new Date();
    if (
      sub.status === SubscriptionStatus.CANCELLED ||
      sub.status === SubscriptionStatus.EXPIRED ||
      sub.status === SubscriptionStatus.SUSPENDED ||
      sub.endDate < now
    ) {
      throw new ForbiddenException(
        "Votre abonnement a expiré. Renouvelez votre abonnement pour continuer à utiliser toutes les fonctionnalités.",
      );
    }

    return true;
  }
}
