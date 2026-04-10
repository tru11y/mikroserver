import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { InjectRedis } from "../queue/decorators/inject-redis.decorator";
import { Redis } from "ioredis";
import { statfs } from "fs/promises";

@ApiTags("health")
@Controller({ path: "health", version: "1" })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** Backward-compatible full health check (DB + Redis). */
  @Public()
  @Get()
  @ApiOperation({ summary: "System health check" })
  async check() {
    return this.fullCheck();
  }

  /**
   * Kubernetes readiness probe — checks DB + Redis.
   * Returns 503 implicitly via error if a dependency is down.
   */
  @Public()
  @Get("ready")
  @ApiOperation({ summary: "Readiness probe — checks DB and Redis" })
  async ready() {
    return this.fullCheck();
  }

  /** Kubernetes liveness probe — fast, just confirms the process is alive. */
  @Public()
  @Get("live")
  @ApiOperation({ summary: "Liveness probe — process alive check" })
  live() {
    return { status: "alive", timestamp: new Date().toISOString() };
  }

  private async fullCheck() {
    let databaseStatus = "up";
    let redisStatus = "up";
    let diskStatus = "up";
    let diskFreeGb: number | null = null;
    let diskUsedPercent: number | null = null;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = "down";
    }

    try {
      await this.redis.ping();
    } catch {
      redisStatus = "down";
    }

    try {
      const stats = await statfs("/");
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bfree * stats.bsize;
      diskFreeGb = Math.round((freeBytes / 1024 ** 3) * 10) / 10;
      diskUsedPercent = Math.round(
        ((totalBytes - freeBytes) / totalBytes) * 100,
      );
      // Warn if less than 1 GB free or more than 90% used
      if (diskFreeGb < 1 || diskUsedPercent > 90) {
        diskStatus = "warning";
      }
    } catch {
      diskStatus = "unknown";
    }

    const overallOk =
      databaseStatus === "up" && redisStatus === "up" && diskStatus !== "down";

    return {
      status: overallOk ? "ok" : "error",
      timestamp: new Date().toISOString(),
      details: {
        database: { status: databaseStatus },
        redis: { status: redisStatus },
        disk: {
          status: diskStatus,
          ...(diskFreeGb !== null
            ? { freeGb: diskFreeGb, usedPercent: diskUsedPercent }
            : {}),
        },
      },
    };
  }
}
