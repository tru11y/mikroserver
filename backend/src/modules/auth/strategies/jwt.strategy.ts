import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { UserStatus } from "@prisma/client";
import { resolveUserPermissions } from "../permissions/permissions.constants";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("jwt.accessSecret"),
      algorithms: ["HS256"],
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Validate user still exists and is active on every request
    // This allows immediate revocation by suspending the user
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        permissionProfile: true,
        permissions: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Access denied");
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissionProfile: user.permissionProfile,
      permissions: resolveUserPermissions(
        user.role,
        user.permissions,
        user.permissionProfile,
      ),
    };
  }
}
