import {
  GatewayTimeoutException,
  ServiceUnavailableException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, RouterStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { mergeRouterMetadata } from "./router-api.types";

// ---------------------------------------------------------------------------
// Timeout profiles
// ---------------------------------------------------------------------------

export type RouterOperationTimeoutProfile =
  | "default"
  | "write"
  | "health"
  | "live"
  | "heavy-read";

export interface RouterOperationTimeouts {
  default: number;
  write: number;
  health: number;
  live: number;
  "heavy-read": number;
}

export function buildRouterOperationTimeouts(
  configService: ConfigService,
): RouterOperationTimeouts {
  return {
    default: configService.get<number>("mikrotik.apiTimeoutMs", 10000),
    write: configService.get<number>("mikrotik.writeTimeoutMs", 15000),
    health: configService.get<number>("mikrotik.healthTimeoutMs", 10000),
    live: configService.get<number>("mikrotik.liveTimeoutMs", 20000),
    "heavy-read": configService.get<number>(
      "mikrotik.heavyReadTimeoutMs",
      30000,
    ),
  };
}

export function getRouterOperationTimeoutMs(
  timeouts: RouterOperationTimeouts,
  profile: RouterOperationTimeoutProfile,
): number {
  return timeouts[profile] ?? timeouts.default;
}

// ---------------------------------------------------------------------------
// Failure recording
// ---------------------------------------------------------------------------

export async function recordRouterSyncFailure(
  routerId: string,
  error: unknown,
  ctx: { prisma: PrismaService; logger: Logger },
): Promise<void> {
  const errMsg = error instanceof Error ? error.message : String(error);

  ctx.logger.warn(`Router ${routerId} sync failure: ${errMsg}`);

  try {
    const router = await ctx.prisma.router.findUnique({
      where: { id: routerId },
      select: { metadata: true },
    });

    if (!router) {
      return;
    }

    await ctx.prisma.router.update({
      where: { id: routerId },
      data: {
        status: RouterStatus.DEGRADED,
        metadata: mergeRouterMetadata(
          router.metadata as Prisma.JsonValue | null,
          {
            lastSyncAt: new Date().toISOString(),
            lastSyncError: errMsg,
          },
        ),
      },
    });
  } catch (dbErr) {
    ctx.logger.warn(
      `Failed to mark router ${routerId} as DEGRADED: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

export function isRouterTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("socket timeout")
  );
}

export function toRouterHttpException(
  operationLabel: string,
  error: unknown,
): Error {
  if (
    error instanceof ServiceUnavailableException ||
    (error instanceof Error && "status" in error)
  ) {
    return error as Error;
  }

  const errMsg = error instanceof Error ? error.message : String(error);

  if (isRouterTimeoutError(error)) {
    return new GatewayTimeoutException(
      `Le routeur a mis trop de temps pour ${operationLabel}. Detail: ${errMsg}`,
    );
  }

  return new ServiceUnavailableException(
    `Impossible de ${operationLabel} : ${errMsg}`,
  );
}
