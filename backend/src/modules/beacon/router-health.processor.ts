import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { RouterStatus } from "@prisma/client";

/**
 * Cron: every 60 seconds, mark routers OFFLINE if no beacon in last 3 minutes.
 */
@Injectable()
export class RouterHealthProcessor {
  private readonly logger = new Logger(RouterHealthProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron("0 * * * * *") // Every minute
  async markOfflineRouters(): Promise<void> {
    const threshold = new Date(Date.now() - 3 * 60 * 1000);

    const result = await this.prisma.router.updateMany({
      where: {
        deletedAt: null,
        status: RouterStatus.ONLINE,
        lastSeenAt: { lt: threshold },
      },
      data: { status: RouterStatus.OFFLINE },
    });

    if (result.count > 0) {
      this.logger.warn(
        `Marked ${result.count} router(s) OFFLINE (no beacon in 3min)`,
      );
    }
  }
}
