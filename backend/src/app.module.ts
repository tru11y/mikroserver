import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import {
  appConfig,
  dbConfig,
  redisConfig,
  jwtConfig,
  waveConfig,
  cinetpayConfig,
  mikrotikConfig,
  queueConfig,
  securityConfig,
} from "./config/app.config";
import { getConfig } from "./config/configuration";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { PlansModule } from "./modules/plans/plans.module";
import { TransactionsModule } from "./modules/transactions/transactions.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { VouchersModule } from "./modules/vouchers/vouchers.module";
import { RoutersModule } from "./modules/routers/routers.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { SessionsModule } from "./modules/sessions/sessions.module";
import { MetricsModule } from "./modules/metrics/metrics.module";
import { QueueModule } from "./modules/queue/queue.module";
import { HealthModule } from "./modules/health/health.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { AuditModule } from "./modules/audit/audit.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { SaasModule } from "./modules/saas/saas.module";
import { AccountingModule } from "./modules/accounting/accounting.module";
import { ResellersModule } from "./modules/resellers/resellers.module";
import { WhiteLabelModule } from "./modules/white-label/white-label.module";
import { ApiKeysModule } from "./modules/api-keys/api-keys.module";
import { SpeedBoostsModule } from "./modules/speed-boosts/speed-boosts.module";
import { InsightsModule } from "./modules/insights/insights.module";
import { AdminModule } from "./modules/admin/admin.module";
import { SshModule } from "./modules/ssh/ssh.module";

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  imports: [
    // --- Configuration ---
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        dbConfig,
        redisConfig,
        jwtConfig,
        waveConfig,
        cinetpayConfig,
        mikrotikConfig,
        queueConfig,
        securityConfig,
      ],
      cache: true,
    }),

    // --- Structured logging with Pino ---
    LoggerModule.forRootAsync({
      useFactory: () => {
        const cfg = getConfig();
        return {
          pinoHttp: {
            level: cfg.LOG_LEVEL,
            transport: cfg.LOG_PRETTY
              ? {
                  target: "pino-pretty",
                  options: { colorize: true, singleLine: false },
                }
              : undefined,
            serializers: {
              req(req: Record<string, unknown>) {
                return {
                  method: req["method"],
                  url: req["url"],
                  id: req["id"],
                };
              },
              // Never log authorization headers
              res(res: Record<string, unknown>) {
                return { statusCode: res["statusCode"] };
              },
            },
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "req.body.password",
                "req.body.passwordHash",
                "req.body.token",
                "req.body.apiKey",
              ],
              censor: "[REDACTED]",
            },
          },
        };
      },
    }),

    // --- Scheduled tasks ---
    ScheduleModule.forRoot(),

    // --- Rate limiting ---
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const cfg = getConfig();
        return {
          throttlers: [
            {
              name: "global",
              ttl: Math.floor(cfg.RATE_LIMIT_TTL_MS / 1000), // seconds
              limit: cfg.RATE_LIMIT_MAX,
            },
          ],
        };
      },
    }),

    // --- Feature modules ---
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    PlansModule,
    TransactionsModule,
    PaymentsModule,
    VouchersModule,
    RoutersModule,
    SettingsModule,
    SessionsModule,
    MetricsModule,
    QueueModule,
    HealthModule,
    WebhooksModule,
    NotificationsModule,
    CustomersModule,
    SaasModule,
    AccountingModule,
    ResellersModule,
    WhiteLabelModule,
    ApiKeysModule,
    SpeedBoostsModule,
    InsightsModule,
    AdminModule,
    SshModule,
  ],
})
export class AppModule {}
