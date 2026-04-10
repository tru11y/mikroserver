import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import CircuitBreaker from "opossum";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { Router, RouterStatus, NotificationType } from "@prisma/client";
import type {
  HotspotActiveClient,
  HotspotIpBindingType,
  HotspotUserConfig,
  LegacyTicketLookupResult,
  MikroTikConnection,
  MikroTikModule,
  RouterBandwidthStats,
  RouterCredentials,
  RouterHealthResult,
  RouterHotspotIpBinding,
  RouterHotspotUser,
  RouterHotspotUserProfile,
  RouterHotspotUserProfileUpdateResult,
  RouterInterfaceStats,
  RouterLiveStats,
  RouterSyncSummary,
} from "./router-api.types";
import { findLegacyTicketAcrossRouters } from "./router-legacy-ticket.operations";
import { buildRouterLiveStats } from "./router-hotspot-live.utils";
import {
  createRouterHotspotIpBinding,
  getRouterHotspotIpBindings,
  removeRouterHotspotIpBinding,
  updateRouterHotspotIpBinding,
} from "./router-hotspot-ip-bindings.operations";
import {
  createRouterHotspotUserProfile,
  getRouterHotspotUserProfiles,
  removeRouterHotspotUserProfile,
  updateRouterHotspotUserProfileConfig,
} from "./router-hotspot-profiles.operations";
import { syncRouterHotspotActiveClients } from "./router-hotspot-sync.utils";
import {
  executeRouterOperation,
  executeRouterOperationResult,
  fetchRouterHotspotActiveClients,
  runRouterIdentityCheck,
} from "./router-routeros.transport";
import {
  getRouterHotspotUsers,
  updateRouterHotspotUserProfile,
} from "./router-hotspot-users.operations";
import { pushHotspotUserToRouter } from "./router-hotspot-delivery.operations";
import {
  disconnectRouterHotspotActiveSession,
  disconnectRouterHotspotActiveSessionsByUsername,
  removeRouterHotspotUser,
  updateRouterHotspotUserRateLimit,
} from "./router-hotspot-writes.operations";
import { checkRouterHealthStatus } from "./router-health.operations";
import {
  addHotspotUser,
  findLegacyActiveClients,
  findLegacyHotspotUsers,
} from "./router-api.commands";
import type { RouterConnectionTarget } from "./router-operations.types";
import {
  buildRouterOperationTimeouts,
  getRouterOperationTimeoutMs,
  isRouterTimeoutError,
  recordRouterSyncFailure,
  toRouterHttpException,
  type RouterOperationTimeoutProfile,
  type RouterOperationTimeouts,
} from "./router-runtime.utils";

export type {
  LegacyTicketLookupResult,
  RouterBandwidthStats,
  RouterHealthResult,
  RouterHotspotIpBinding,
  RouterHotspotUser,
  RouterHotspotUserProfile,
  RouterHotspotUserProfileUpdateResult,
  RouterLiveStats,
  RouterSyncSummary,
} from "./router-api.types";

// MikroTik RouterOS API client
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const MikroNode = require("mikrotik") as MikroTikModule;

/**
 * RouterOS API Integration Service
 *
 * ARCHITECTURAL DECISIONS:
 * 1. Circuit breaker per-router via opossum — prevents cascade failures
 *    when a router is offline. After 50% failure rate, opens circuit for 30s.
 * 2. Connection per-operation (no persistent connection pool) — RouterOS API
 *    connections are cheap and long-lived connections cause issues.
 * 3. All operations wrapped in try/finally to ensure connections are closed.
 * 4. Router credentials stored encrypted (password in separate table in prod).
 * 5. WireGuard tunnel ensures all API traffic is encrypted.
 */

@Injectable()
export class RouterApiService {
  private readonly logger = new Logger(RouterApiService.name);

  // Circuit breakers per router (keyed by routerId)
  private readonly circuitBreakers = new Map<
    string,
    CircuitBreaker<[RouterCredentials, HotspotUserConfig], void>
  >();

  // Last bandwidth poll per router for delta computation
  private readonly lastPoll = new Map<
    string,
    { time: number; bytesIn: number; bytesOut: number }
  >();

  private readonly cbTimeout: number;
  private readonly cbResetMs: number;
  private readonly cbThreshold: number;
  private readonly routerTimeouts: RouterOperationTimeouts;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {
    this.routerTimeouts = buildRouterOperationTimeouts(this.configService);
    this.cbTimeout = this.configService.get<number>(
      "mikrotik.circuitBreakerTimeoutMs",
      10000,
    );
    this.cbResetMs = this.configService.get<number>(
      "mikrotik.circuitBreakerResetMs",
      30000,
    );
    this.cbThreshold = this.configService.get<number>(
      "mikrotik.circuitBreakerThreshold",
      50,
    );
  }

  // ---------------------------------------------------------------------------
  // Push Hotspot User to MikroTik
  // ---------------------------------------------------------------------------

  async pushHotspotUser(
    routerId: string,
    voucherId: string,
    config: HotspotUserConfig,
  ): Promise<void> {
    return pushHotspotUserToRouter(routerId, voucherId, config, {
      prisma: this.prisma,
      getOrCreateBreaker: (targetRouterId) =>
        this.getOrCreateBreaker(targetRouterId),
      logger: this.logger,
    });
  }

  // ---------------------------------------------------------------------------
  // Delete Hotspot User (revocation)
  // ---------------------------------------------------------------------------

  async removeHotspotUser(routerId: string, username: string): Promise<void> {
    const router = await this.getRouterConnectionTarget(routerId);
    await removeRouterHotspotUser(router, username, {
      parseItems: MikroNode.parseItems,
      executeOnRouter: (target, operation) =>
        this.executeOnRouterTarget(
          target,
          operation,
          this.getRouterOperationTimeoutMs("write"),
        ),
      executeOnRouterResult: (target, operation) =>
        this.executeOnRouterTargetResult(
          target,
          operation,
          this.getRouterOperationTimeoutMs("write"),
        ),
      logger: this.logger,
    });
  }

  async disconnectActiveSessionsByUsername(
    routerId: string,
    username: string,
  ): Promise<number> {
    const router = await this.getRouterConnectionTarget(routerId);
    return disconnectRouterHotspotActiveSessionsByUsername(router, username, {
      parseItems: MikroNode.parseItems,
      executeOnRouter: (target, operation) =>
        this.executeOnRouterTarget(
          target,
          operation,
          this.getRouterOperationTimeoutMs("write"),
        ),
      executeOnRouterResult: (target, operation) =>
        this.executeOnRouterTargetResult(
          target,
          operation,
          this.getRouterOperationTimeoutMs("write"),
        ),
      logger: this.logger,
    });
  }

  async disconnectActiveSession(
    routerId: string,
    mikrotikId: string,
  ): Promise<void> {
    const router = await this.getRouterConnectionTarget(routerId);
    await disconnectRouterHotspotActiveSession(router, mikrotikId, {
      parseItems: MikroNode.parseItems,
      executeOnRouter: (target, operation) =>
        this.executeOnRouterTarget(
          target,
          operation,
          this.getRouterOperationTimeoutMs("write"),
        ),
      executeOnRouterResult: (target, operation) =>
        this.executeOnRouterTargetResult(
          target,
          operation,
          this.getRouterOperationTimeoutMs("write"),
        ),
      logger: this.logger,
    });
  }

  // ---------------------------------------------------------------------------
  // Live stats — active clients + bandwidth from MikroTik
  // ---------------------------------------------------------------------------

  async getLiveStats(routerId: string): Promise<RouterLiveStats> {
    const router = await this.prisma.router.findUniqueOrThrow({
      where: { id: routerId, deletedAt: null },
    });

    return this.runProtectedRouterOperation({
      operationLabel: "charger les statistiques live du routeur",
      timeoutProfile: "live",
      onError: (error) =>
        recordRouterSyncFailure(routerId, error, {
          prisma: this.prisma,
          logger: this.logger,
        }),
      run: async (timeoutMs) => {
        const rawClients = await this.fetchHotspotActiveClients(
          router,
          timeoutMs,
        );
        const syncSummary = await syncRouterHotspotActiveClients(
          {
            prisma: this.prisma,
            disconnectActiveSession: (targetRouterId, mikrotikId) =>
              this.disconnectActiveSession(targetRouterId, mikrotikId),
            logger: this.logger,
          },
          router,
          rawClients,
        );
        const { stats, nextPoll } = buildRouterLiveStats({
          routerId,
          rawClients,
          syncSummary,
          lastPoll: this.lastPoll.get(routerId),
        });
        this.lastPoll.set(routerId, nextPoll);

        await this.prisma.router.update({
          where: { id: routerId },
          data: { status: RouterStatus.ONLINE, lastSeenAt: new Date() },
        });

        return stats;
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Bandwidth stats — interface-level tx/rx bytes + active connections
  // ---------------------------------------------------------------------------

  async getBandwidthStats(routerId: string): Promise<RouterBandwidthStats> {
    const router = await this.getRouterConnectionTarget(routerId);

    try {
      return await this.runProtectedRouterOperation({
        operationLabel: "charger les statistiques de bande passante du routeur",
        timeoutProfile: "live",
        run: async (timeoutMs) => {
          interface InterfaceRecord {
            name?: string;
            "tx-byte"?: string;
            "rx-byte"?: string;
            running?: string | boolean;
          }

          const [ifaceRecords, activeClients] = await Promise.all([
            this.executeOnRouterTargetResult<InterfaceRecord[]>(
              router,
              (conn) =>
                new Promise<InterfaceRecord[]>((resolve, reject) => {
                  const channel = conn.openChannel();
                  channel.write([
                    "/interface/print",
                    "=stats=",
                    "=proplist=name,tx-byte,rx-byte,running",
                  ]);
                  channel.on("trap", reject);
                  channel.once("done", (data: unknown) => {
                    try {
                      resolve(MikroNode.parseItems<InterfaceRecord>(data));
                    } catch (err) {
                      reject(err);
                    }
                  });
                }),
              timeoutMs,
            ),
            this.executeOnRouterTargetResult<{ ".id"?: string }[]>(
              router,
              (conn) =>
                new Promise<{ ".id"?: string }[]>((resolve, reject) => {
                  const channel = conn.openChannel();
                  const params = router.hotspotServer
                    ? [
                        "/ip/hotspot/active/print",
                        `?server=${router.hotspotServer}`,
                      ]
                    : ["/ip/hotspot/active/print"];
                  channel.write(params);
                  channel.on("trap", reject);
                  channel.once("done", (data: unknown) => {
                    try {
                      resolve(MikroNode.parseItems<{ ".id"?: string }>(data));
                    } catch (err) {
                      reject(err);
                    }
                  });
                }),
              timeoutMs,
            ),
          ]);

          const interfaces: RouterInterfaceStats[] = ifaceRecords.map(
            (iface) => {
              const txBytes = parseInt(iface["tx-byte"] ?? "0", 10) || 0;
              const rxBytes = parseInt(iface["rx-byte"] ?? "0", 10) || 0;
              const running =
                iface.running === true ||
                iface.running === "true" ||
                iface.running === "yes";
              return {
                name: iface.name ?? "unknown",
                txBytes,
                rxBytes,
                running,
              };
            },
          );

          const totalTxBytes = interfaces.reduce(
            (sum, i) => sum + i.txBytes,
            0,
          );
          const totalRxBytes = interfaces.reduce(
            (sum, i) => sum + i.rxBytes,
            0,
          );

          return {
            totalTxBytes,
            totalRxBytes,
            activeConnections: activeClients.length,
            interfaces,
          };
        },
      });
    } catch {
      // If router is offline / circuit breaker open, return zeros gracefully
      return {
        totalTxBytes: 0,
        totalRxBytes: 0,
        activeConnections: 0,
        interfaces: [],
      };
    }
  }

  async syncRouterState(routerId: string): Promise<RouterSyncSummary> {
    const router = await this.prisma.router.findUniqueOrThrow({
      where: { id: routerId, deletedAt: null },
    });

    return this.runProtectedRouterOperation({
      operationLabel: "synchroniser les sessions hotspot du routeur",
      timeoutProfile: "heavy-read",
      onError: (error) =>
        recordRouterSyncFailure(routerId, error, {
          prisma: this.prisma,
          logger: this.logger,
        }),
      run: async (timeoutMs) => {
        const rawClients = await this.fetchHotspotActiveClients(
          router,
          timeoutMs,
        );
        return syncRouterHotspotActiveClients(
          {
            prisma: this.prisma,
            disconnectActiveSession: (targetRouterId, mikrotikId) =>
              this.disconnectActiveSession(targetRouterId, mikrotikId),
            logger: this.logger,
          },
          router,
          rawClients,
        );
      },
    });
  }

  async getHotspotUserProfiles(
    routerId: string,
  ): Promise<RouterHotspotUserProfile[]> {
    const router = await this.getRouterConnectionTarget(routerId);
    return this.runProtectedRouterOperation({
      operationLabel: "charger les profils hotspot du routeur",
      timeoutProfile: "heavy-read",
      run: (timeoutMs) =>
        getRouterHotspotUserProfiles(router, {
          parseItems: MikroNode.parseItems,
          executeOnRouterResult: (target, operation) =>
            this.executeOnRouterTargetResult(target, operation, timeoutMs),
        }),
    });
  }

  async createHotspotUserProfile(
    routerId: string,
    params: {
      name: string;
      rateLimit?: string;
      sharedUsers?: number;
      sessionTimeout?: string;
      idleTimeout?: string;
      keepaliveTimeout?: string;
      addressPool?: string;
    },
  ): Promise<RouterHotspotUserProfile> {
    const router = await this.getRouterConnectionTarget(routerId);
    return this.runProtectedRouterOperation({
      operationLabel: "creer un profil hotspot sur le routeur",
      timeoutProfile: "write",
      run: (timeoutMs) =>
        createRouterHotspotUserProfile(router, params, {
          parseItems: MikroNode.parseItems,
          executeOnRouterResult: (target, operation) =>
            this.executeOnRouterTargetResult(target, operation, timeoutMs),
        }),
    });
  }

  async updateHotspotUserProfileConfig(
    routerId: string,
    params: {
      profileId: string;
      name?: string;
      rateLimit?: string;
      sharedUsers?: number;
      sessionTimeout?: string;
      idleTimeout?: string;
      keepaliveTimeout?: string;
      addressPool?: string;
    },
  ): Promise<RouterHotspotUserProfile> {
    const router = await this.getRouterConnectionTarget(routerId);
    return this.runProtectedRouterOperation({
      operationLabel: "mettre a jour un profil hotspot sur le routeur",
      timeoutProfile: "write",
      run: (timeoutMs) =>
        updateRouterHotspotUserProfileConfig(router, params, {
          parseItems: MikroNode.parseItems,
          executeOnRouterResult: (target, operation) =>
            this.executeOnRouterTargetResult(target, operation, timeoutMs),
        }),
    });
  }

  async removeHotspotUserProfile(
    routerId: string,
    profileId: string,
  ): Promise<void> {
    const router = await this.getRouterConnectionTarget(routerId);
    return this.runProtectedRouterOperation({
      operationLabel: "supprimer un profil hotspot sur le routeur",
      timeoutProfile: "write",
      run: async (timeoutMs) => {
        await removeRouterHotspotUserProfile(router, profileId, {
          parseItems: MikroNode.parseItems,
          executeOnRouterResult: (target, operation) =>
            this.executeOnRouterTargetResult(target, operation, timeoutMs),
        });
      },
    });
  }

  async getHotspotIpBindings(
    routerId: string,
  ): Promise<RouterHotspotIpBinding[]> {
    const router = await this.getRouterConnectionTarget(routerId);
    return this.runProtectedRouterOperation({
      operationLabel: "charger les IP bindings du routeur",
      timeoutProfile: "heavy-read",
      run: (timeoutMs) =>
        getRouterHotspotIpBindings(router, {
          parseItems: MikroNode.parseItems,
          executeOnRouterResult: (target, operation) =>
            this.executeOnRouterTargetResult(target, operation, timeoutMs),
        }),
    });
  }

  async createHotspotIpBinding(
    routerId: string,
    params: {
      server?: string;
      address?: string;
      macAddress?: string;
      type?: HotspotIpBindingType;
      comment?: string;
      toAddress?: string;
      addressList?: string;
      disabled?: boolean;
    },
  ): Promise<RouterHotspotIpBinding> {
    const router = await this.getRouterConnectionTarget(routerId);
    return this.runProtectedRouterOperation({
      operationLabel: "creer un IP binding sur le routeur",
      timeoutProfile: "write",
      run: (timeoutMs) =>
        createRouterHotspotIpBinding(router, params, {
          parseItems: MikroNode.parseItems,
          executeOnRouterResult: (target, operation) =>
            this.executeOnRouterTargetResult(target, operation, timeoutMs),
        }),
    });
  }

  async updateHotspotIpBinding(
    routerId: string,
    params: {
      bindingId: string;
      server?: string | null;
      address?: string | null;
      macAddress?: string | null;
      type?: HotspotIpBindingType;
      comment?: string | null;
      toAddress?: string | null;
      addressList?: string | null;
      disabled?: boolean;
    },
  ): Promise<RouterHotspotIpBinding> {
    const router = await this.getRouterConnectionTarget(routerId);
    return this.runProtectedRouterOperation({
      operationLabel: "mettre a jour un IP binding sur le routeur",
      timeoutProfile: "write",
      run: (timeoutMs) =>
        updateRouterHotspotIpBinding(router, params, {
          parseItems: MikroNode.parseItems,
          executeOnRouterResult: (target, operation) =>
            this.executeOnRouterTargetResult(target, operation, timeoutMs),
        }),
    });
  }

  async removeHotspotIpBinding(
    routerId: string,
    bindingId: string,
  ): Promise<void> {
    const router = await this.getRouterConnectionTarget(routerId);
    return this.runProtectedRouterOperation({
      operationLabel: "supprimer un IP binding sur le routeur",
      timeoutProfile: "write",
      run: async (timeoutMs) => {
        await removeRouterHotspotIpBinding(router, bindingId, {
          parseItems: MikroNode.parseItems,
          executeOnRouterResult: (target, operation) =>
            this.executeOnRouterTargetResult(target, operation, timeoutMs),
        });
      },
    });
  }

  async setHotspotIpBindingBlocked(
    routerId: string,
    bindingId: string,
    blocked: boolean,
  ): Promise<RouterHotspotIpBinding> {
    return this.updateHotspotIpBinding(routerId, {
      bindingId,
      type: blocked ? "blocked" : "regular",
      disabled: false,
    });
  }

  async setHotspotIpBindingDisabled(
    routerId: string,
    bindingId: string,
    disabled: boolean,
  ): Promise<RouterHotspotIpBinding> {
    return this.updateHotspotIpBinding(routerId, {
      bindingId,
      disabled,
    });
  }

  async getHotspotUsers(
    routerId: string,
    search?: string,
  ): Promise<RouterHotspotUser[]> {
    const router = await this.getRouterConnectionTarget(routerId);
    return this.runProtectedRouterOperation({
      operationLabel: "charger les utilisateurs hotspot du routeur",
      timeoutProfile: "heavy-read",
      run: (timeoutMs) =>
        getRouterHotspotUsers(router, search, {
          parseItems: MikroNode.parseItems,
          executeOnRouterResult: (target, operation) =>
            this.executeOnRouterTargetResult(target, operation, timeoutMs),
          prisma: this.prisma,
          nowMs: () => Date.now(),
        }),
    });
  }

  async updateHotspotUserProfile(
    routerId: string,
    params: {
      userId: string;
      profile: string;
      disconnectActive?: boolean;
    },
  ): Promise<RouterHotspotUserProfileUpdateResult> {
    const router = await this.getRouterConnectionTarget(routerId);
    return this.runProtectedRouterOperation({
      operationLabel: "mettre a jour le profil d un utilisateur hotspot",
      timeoutProfile: "write",
      run: (timeoutMs) =>
        updateRouterHotspotUserProfile(router, params, {
          parseItems: MikroNode.parseItems,
          executeOnRouterResult: (target, operation) =>
            this.executeOnRouterTargetResult(target, operation, timeoutMs),
        }),
    });
  }

  async findLegacyTicket(
    codeCandidates: string[],
    passwordCandidates: string[],
    preferredRouterId?: string,
  ): Promise<LegacyTicketLookupResult | null> {
    return findLegacyTicketAcrossRouters(
      codeCandidates,
      passwordCandidates,
      preferredRouterId,
      {
        prisma: this.prisma,
        parseItems: MikroNode.parseItems,
        executeOnRouterResult: (target, operation) =>
          this.executeOnRouterTargetResult(
            target,
            operation,
            getRouterOperationTimeoutMs(this.routerTimeouts, "heavy-read"),
          ),
        findUsers: findLegacyHotspotUsers,
        findActiveClients: findLegacyActiveClients,
        logger: this.logger,
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Health check a router
  // ---------------------------------------------------------------------------

  async updateHotspotUserRateLimit(
    routerId: string,
    username: string,
    rateLimit: string,
  ): Promise<void> {
    const router = await this.getRouterConnectionTarget(routerId);
    return this.runProtectedRouterOperation({
      operationLabel: "mettre à jour le débit hotspot de l'utilisateur",
      timeoutProfile: "write",
      run: async (timeoutMs) => {
        await updateRouterHotspotUserRateLimit(router, username, rateLimit, {
          parseItems: MikroNode.parseItems,
          executeOnRouter: (target, operation) =>
            this.executeOnRouterTarget(target, operation, timeoutMs),
          executeOnRouterResult: (target, operation) =>
            this.executeOnRouterTargetResult(target, operation, timeoutMs),
          logger: this.logger,
        });
      },
    });
  }

  async checkRouterHealth(routerId: string): Promise<RouterHealthResult> {
    const router = await this.prisma.router.findUnique({
      where: { id: routerId, deletedAt: null },
    });

    if (!router) {
      return {
        online: false,
        newStatus: RouterStatus.OFFLINE,
        error: "Routeur introuvable",
      };
    }

    if (!router.wireguardIp) {
      return {
        online: false,
        newStatus: RouterStatus.OFFLINE,
        error: "IP WireGuard non configurée",
      };
    }

    const previousStatus = router.status;

    const result = await checkRouterHealthStatus(
      router as typeof router & { wireguardIp: string },
      {
        prisma: this.prisma,
        mikroNode: MikroNode,
        timeoutMs: getRouterOperationTimeoutMs(this.routerTimeouts, "health"),
        runIdentityCheck: runRouterIdentityCheck,
      },
    );

    // Emit notification only when status actually changes in DB
    if (this.notificationsService) {
      if (
        previousStatus !== result.newStatus &&
        previousStatus !== RouterStatus.MAINTENANCE
      ) {
        if (result.newStatus === RouterStatus.OFFLINE) {
          await this.notificationsService
            .notifyRouterOwner(routerId, {
              type: NotificationType.ROUTER_OFFLINE,
              title: "Routeur hors ligne",
              body: `Le routeur "${router.name}" est hors ligne`,
              data: { routerId, routerName: router.name },
              routerId,
            })
            .catch(() => {});
        } else if (result.newStatus === RouterStatus.ONLINE) {
          await this.notificationsService
            .notifyRouterOwner(routerId, {
              type: NotificationType.ROUTER_ONLINE,
              title: "Routeur en ligne",
              body: `Le routeur "${router.name}" est de nouveau en ligne`,
              data: { routerId, routerName: router.name },
              routerId,
            })
            .catch(() => {});
        }
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getOrCreateBreaker(
    routerId: string,
  ): CircuitBreaker<[RouterCredentials, HotspotUserConfig], void> {
    if (!this.circuitBreakers.has(routerId)) {
      const breaker = new CircuitBreaker(
        async (creds: RouterCredentials, config: HotspotUserConfig) => {
          await this.executeOnRouter(
            creds.wireguardIp,
            creds.apiPort,
            creds.apiUsername,
            creds.apiPasswordHash,
            async (conn) => {
              await addHotspotUser(conn, config);
            },
          );
        },
        {
          timeout: this.cbTimeout,
          errorThresholdPercentage: this.cbThreshold,
          resetTimeout: this.cbResetMs,
          volumeThreshold: 5,
          name: `router-${routerId}`,
        },
      );

      breaker.on("open", () =>
        this.logger.error(`Circuit OPEN for router ${routerId}`),
      );
      breaker.on("halfOpen", () =>
        this.logger.warn(`Circuit HALF-OPEN for router ${routerId}`),
      );
      breaker.on("close", () =>
        this.logger.log(`Circuit CLOSED for router ${routerId}`),
      );

      this.circuitBreakers.set(routerId, breaker);
    }

    return this.circuitBreakers.get(routerId)!;
  }

  /** Remove circuit breaker for a deleted router to free memory. */
  evictCircuitBreaker(routerId: string): void {
    const cb = this.circuitBreakers.get(routerId);
    if (cb) {
      cb.shutdown();
      this.circuitBreakers.delete(routerId);
      this.lastPoll.delete(routerId);
      this.logger.log(`Circuit breaker evicted for deleted router ${routerId}`);
    }
  }

  private async executeOnRouterResult<T>(
    wireguardIp: string,
    apiPort: number,
    username: string,
    password: string,
    operation: (conn: MikroTikConnection) => Promise<T>,
    timeoutMs = getRouterOperationTimeoutMs(this.routerTimeouts, "default"),
  ): Promise<T> {
    return executeRouterOperationResult({
      mikroNode: MikroNode,
      wireguardIp,
      apiPort,
      username,
      password,
      timeoutMs,
      operation,
    });
  }

  private async executeOnRouterTargetResult<T>(
    router: RouterConnectionTarget,
    operation: (conn: MikroTikConnection) => Promise<T>,
    timeoutMs = getRouterOperationTimeoutMs(this.routerTimeouts, "default"),
  ): Promise<T> {
    return this.executeOnRouterResult(
      router.wireguardIp,
      router.apiPort,
      router.apiUsername,
      router.apiPasswordHash,
      operation,
      timeoutMs,
    );
  }

  private async executeOnRouterTarget(
    router: RouterConnectionTarget,
    operation: (conn: MikroTikConnection) => Promise<void>,
    timeoutMs = getRouterOperationTimeoutMs(this.routerTimeouts, "default"),
  ): Promise<void> {
    await this.executeOnRouter(
      router.wireguardIp,
      router.apiPort,
      router.apiUsername,
      router.apiPasswordHash,
      operation,
      timeoutMs,
    );
  }

  private async executeOnRouter(
    wireguardIp: string,
    apiPort: number,
    username: string,
    password: string,
    operation: (conn: MikroTikConnection) => Promise<void>,
    timeoutMs = getRouterOperationTimeoutMs(this.routerTimeouts, "default"),
  ): Promise<void> {
    await executeRouterOperation({
      mikroNode: MikroNode,
      wireguardIp,
      apiPort,
      username,
      password,
      timeoutMs,
      operation,
    });
  }

  private async fetchHotspotActiveClients(
    router: Pick<
      Router,
      | "id"
      | "wireguardIp"
      | "apiPort"
      | "apiUsername"
      | "apiPasswordHash"
      | "hotspotServer"
    >,
    timeoutMs = getRouterOperationTimeoutMs(this.routerTimeouts, "live"),
  ): Promise<HotspotActiveClient[]> {
    if (!router.wireguardIp) return [];
    return fetchRouterHotspotActiveClients({
      mikroNode: MikroNode,
      wireguardIp: router.wireguardIp,
      apiPort: router.apiPort,
      username: router.apiUsername,
      password: router.apiPasswordHash,
      hotspotServer: router.hotspotServer,
      timeoutMs,
    });
  }

  private async runProtectedRouterOperation<T>(params: {
    operationLabel: string;
    timeoutProfile: RouterOperationTimeoutProfile;
    run: (timeoutMs: number) => Promise<T>;
    onError?: (error: unknown) => Promise<void>;
  }): Promise<T> {
    const timeoutMs = getRouterOperationTimeoutMs(
      this.routerTimeouts,
      params.timeoutProfile,
    );
    // Write ops retry once on timeout: first attempt warms the WireGuard tunnel,
    // the retry succeeds with the established connection.
    const maxAttempts = params.timeoutProfile === "write" ? 2 : 1;

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await params.run(timeoutMs);
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts && isRouterTimeoutError(error)) {
          this.logger.warn(
            `[RouterAPI] ${params.operationLabel} timeout (attempt ${attempt}/${maxAttempts}), retrying…`,
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        break;
      }
    }

    if (params.onError) {
      await params.onError(lastError);
    }
    throw toRouterHttpException(params.operationLabel, lastError);
  }

  private getRouterOperationTimeoutMs(
    profile: RouterOperationTimeoutProfile,
  ): number {
    return getRouterOperationTimeoutMs(this.routerTimeouts, profile);
  }

  private async getRouterConnectionTarget(
    routerId: string,
  ): Promise<RouterConnectionTarget> {
    const router = await this.prisma.router.findUniqueOrThrow({
      where: { id: routerId, deletedAt: null },
      select: {
        wireguardIp: true,
        apiPort: true,
        apiUsername: true,
        apiPasswordHash: true,
        hotspotServer: true,
      },
    });
    if (!router.wireguardIp) {
      throw new Error(`Router ${routerId} has no WireGuard IP configured`);
    }
    return router as RouterConnectionTarget;
  }
}
