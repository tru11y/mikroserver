import * as net from "net";
import type { Prisma } from "@prisma/client";
import { RouterStatus } from "@prisma/client";
import type { MikroTikModule, RouterHealthResult } from "./router-api.types";
import { mergeRouterMetadata } from "./router-api.types";

const TCP_PROBE_TIMEOUT_MS = 3000;

/**
 * TCP-only reachability probe — no auth attempt.
 * Returns false if the host:port is unreachable within the timeout.
 * This prevents spurious RouterOS login-failure entries in the router's log
 * when the VPN tunnel is down or the API port is not yet reachable.
 */
function tcpProbe(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, family: 4 });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, TCP_PROBE_TIMEOUT_MS);

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

// Number of consecutive health check failures before a router is marked OFFLINE.
// This prevents a single transient network blip from triggering an OFFLINE alert.
const OFFLINE_FAILURE_THRESHOLD = 2;

interface RouterHealthTarget {
  id: string;
  status: RouterStatus;
  wireguardIp: string;
  apiPort: number;
  apiUsername: string;
  apiPasswordHash: string;
  metadata: Prisma.JsonValue | null;
}

interface RouterHealthDeps {
  prisma: {
    router: {
      update: (args: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => Promise<unknown>;
    };
  };
  mikroNode: MikroTikModule;
  timeoutMs: number;
  runIdentityCheck: (args: {
    mikroNode: MikroTikModule;
    wireguardIp: string;
    apiPort: number;
    username: string;
    password: string;
    timeoutMs: number;
  }) => Promise<void>;
}

export async function checkRouterHealthStatus(
  router: RouterHealthTarget,
  deps: RouterHealthDeps,
): Promise<RouterHealthResult> {
  // ── TCP pre-check (3s) ────────────────────────────────────────────────────
  // Test TCP reachability before attempting RouterOS auth.
  // If the tunnel is down this returns fast without generating a login-failure
  // entry in the MikroTik router's log (which happens on auth attempt).
  const apiReachable = await tcpProbe(router.wireguardIp, router.apiPort);

  if (!apiReachable) {
    const errMsg = `API port ${router.apiPort} unreachable on ${router.wireguardIp} (TCP probe timed out)`;

    const currentMeta =
      router.metadata &&
      typeof router.metadata === "object" &&
      !Array.isArray(router.metadata)
        ? (router.metadata as Record<string, unknown>)
        : {};

    const consecutiveHealthFailures =
      typeof currentMeta.consecutiveHealthFailures === "number"
        ? currentMeta.consecutiveHealthFailures + 1
        : 1;

    const newStatus =
      consecutiveHealthFailures >= OFFLINE_FAILURE_THRESHOLD
        ? RouterStatus.OFFLINE
        : router.status;

    await deps.prisma.router.update({
      where: { id: router.id },
      data: {
        status: newStatus,
        metadata: mergeRouterMetadata(router.metadata, {
          lastHealthCheckAt: new Date().toISOString(),
          lastHealthCheckError: errMsg,
          consecutiveHealthFailures,
          apiReachable: false,
        }),
      },
    });

    return { online: false, newStatus, error: errMsg };
  }

  try {
    await deps.runIdentityCheck({
      mikroNode: deps.mikroNode,
      wireguardIp: router.wireguardIp,
      apiPort: router.apiPort,
      username: router.apiUsername,
      password: router.apiPasswordHash,
      timeoutMs: deps.timeoutMs,
    });

    await deps.prisma.router.update({
      where: { id: router.id },
      data: {
        status: RouterStatus.ONLINE,
        lastHeartbeatAt: new Date(),
        lastSeenAt: new Date(),
        metadata: mergeRouterMetadata(router.metadata, {
          lastHealthCheckAt: new Date().toISOString(),
          lastHealthCheckError: null,
          consecutiveHealthFailures: 0,
        }),
      },
    });

    return { online: true, newStatus: RouterStatus.ONLINE };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);

    // Read current consecutive failure count from existing metadata
    const currentMeta =
      router.metadata &&
      typeof router.metadata === "object" &&
      !Array.isArray(router.metadata)
        ? (router.metadata as Record<string, unknown>)
        : {};

    const consecutiveHealthFailures =
      typeof currentMeta.consecutiveHealthFailures === "number"
        ? currentMeta.consecutiveHealthFailures + 1
        : 1;

    // Only flip to OFFLINE once we've hit the threshold — keeps current status on the first failure
    const newStatus =
      consecutiveHealthFailures >= OFFLINE_FAILURE_THRESHOLD
        ? RouterStatus.OFFLINE
        : router.status;

    await deps.prisma.router.update({
      where: { id: router.id },
      data: {
        status: newStatus,
        metadata: mergeRouterMetadata(router.metadata, {
          lastHealthCheckAt: new Date().toISOString(),
          lastHealthCheckError: errMsg,
          consecutiveHealthFailures,
        }),
      },
    });

    return { online: false, newStatus, error: errMsg };
  }
}
