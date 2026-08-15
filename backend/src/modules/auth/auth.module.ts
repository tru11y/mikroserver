import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { APP_GUARD } from "@nestjs/core";
import { AuthService } from "./auth.service";
import { AuthPasswordService } from "./auth-password.service";
import { AuthTokenService } from "./auth-token.service";
import { TwoFactorService } from "./two-factor.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { AuditModule } from "../audit/audit.module";
import { SaasModule } from "../saas/saas.module";
import { SubscriptionActiveGuard } from "../saas/subscription-active.guard";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({}), // Secrets injected per-call via ConfigService
    AuditModule,
    SaasModule,
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthPasswordService,
    AuthTokenService,
    TwoFactorService,
    AuthService,
    JwtStrategy,
    // Guards applied globally — opt-out with @Public() / @Roles() / @Permissions() / @SkipSubscriptionCheck()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: SubscriptionActiveGuard },
  ],
  exports: [AuthService, AuthPasswordService, TwoFactorService, JwtModule],
})
export class AuthModule {}
