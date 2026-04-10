import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FastifyRequest } from "fastify";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { AppPermission } from "../permissions/permissions.constants";
import { JwtPayload } from "../interfaces/jwt-payload.interface";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      AppPermission[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: JwtPayload }>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User context not found");
    }

    const currentPermissions = new Set(user.permissions ?? []);
    const missingPermissions = requiredPermissions.filter(
      (permission) => !currentPermissions.has(permission),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Missing permissions: ${missingPermissions.join(", ")}`,
      );
    }

    return true;
  }
}
