import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SaasService } from "./saas.service";

export const TIER_LIMIT_KEY = "tierLimit";
export const TierLimit = (limit: "routers" | "resellers") =>
  SetMetadata(TIER_LIMIT_KEY, limit);

@Injectable()
export class SaasTierGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly saasService: SaasService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const limit = this.reflector.get<string>(
      TIER_LIMIT_KEY,
      context.getHandler(),
    );
    if (!limit) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { sub: string } }>();
    const userId = request.user?.sub;
    if (!userId) return true; // Let auth guard handle it

    const check = await this.saasService.checkLimit(
      userId,
      limit as "routers" | "resellers",
    );

    if (!check.allowed) {
      throw new ForbiddenException(
        `Limite de votre abonnement atteinte: ${check.current}/${check.limit} ${limit}. Passez à un plan supérieur.`,
      );
    }

    return true;
  }
}
