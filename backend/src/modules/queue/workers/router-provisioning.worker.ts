import { Injectable, Logger } from "@nestjs/common";
import { Worker, Job } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { RouterApiService } from "../../routers/router-api.service";
import { WgIpPoolService } from "../../routers/wg-ip-pool.service";
import { RouterSafeOnboardingService } from "../../routers/router-safe-onboarding.service";
import { QUEUE_NAMES, JOB_NAMES } from "../queue.constants";
import { removeWireGuardPeer } from "../../provisioning/wireguard.utils";
import { sleep } from "../../../common/helpers/sleep";
import { RouterStatus } from "@prisma/client";

/**
 * Job payload — intentionally minimal.
 * Private keys and credentials are read from DB at runtime — never stored in Redis.
 */
export interface RouterProvisionJobData {
  /** Router DB id */
  routerId: string;
  /** X25519 public key — needed to poll `wg show latest-handshakes` on VPS */
  routerPublicKey: string;
  /** WireGuard IP assigned to this router (e.g. "10.66.66.5") */
  wgIp: string;
  /**
   * When true, the worker uses RouterSafeOnboardingService to:
   *   Phase 1: audit the live router (read-only conflict detection)
   *   Phase 2: push WG config via RouterOS API (non-destructive)
   *   Phase 3: add specific route to VPS subnet only
   *   Phase 4: validate tunnel before writing wireguardIp to DB
   *   Phase 5: confirm DB record — only after validation passes
   *
   * When false (mobile-pushed config), the worker only polls for the handshake
   * and confirms wireguardIp in DB on success.
   */
  safeOnboard: boolean;
}

/**
 * RouterProvisioningWorker
 *
 * Two modes controlled by `safeOnboard` flag in job data:
 *
 * [safeOnboard = true] — Production router with RouterOS API access
 *   Delegates entirely to RouterSafeOnboardingService (5-phase flow).
 *   Safe for live routers: read-only audit first, then non-destructive add-only
 *   config, rollback removes only what was added.
 *
 * [safeOnboard = false] — Mobile-provisioned router (user pushed config manually)
 *   Polls VPS wg0 handshake until tunnel is up (max 3 min), then sets wireguardIp.
 *   Rollback removes VPS WG peer + releases IP reservation on failure.
 *
 * WHY BullMQ (not void setTimeout):
 *   Process restart between `addWireGuardPeer()` and the DB update would leave
 *   an orphan VPS peer with no router record.  BullMQ persists the job in Redis;
 *   any healthy replica picks it up on restart.  jobId dedup prevents parallel runs.
 */
@Injectable()
export class RouterProvisioningWorker {
  private readonly logger = new Logger(RouterProvisioningWorker.name);
  private worker: Worker | null = null;

  private readonly POLL_INTERVAL_MS = 5_000;
  private readonly POLL_MAX_ATTEMPTS = 36; // 3 min

  constructor(
    private readonly prisma: PrismaService,
    private readonly routerApiService: RouterApiService,
    private readonly wgIpPool: WgIpPoolService,
    private readonly safeOnboarding: RouterSafeOnboardingService,
    private readonly configService: ConfigService,
  ) {}

  initialize(redisConnection: {
    host: string;
    port: number;
    password?: string;
  }): void {
    this.worker = new Worker(
      QUEUE_NAMES.ROUTER_PROVISION,
      async (job: Job<RouterProvisionJobData>) => {
        await this.processJob(job);
      },
      {
        connection: redisConnection,
        concurrency: 2,
        autorun: true,
        lockDuration: 5 * 60 * 1000,
        lockRenewTime: 60 * 1000,
      },
    );

    this.worker.on("completed", (job) =>
      this.logger.log(
        `[Provision] Job ${job.id} complete — router ${job.data.routerId} → ${job.data.wgIp}`,
      ),
    );

    this.worker.on("failed", (job, err) =>
      this.logger.error(
        `[Provision] Job ${job?.id} FAILED — router ${job?.data.routerId}: ${err.message}`,
      ),
    );

    this.logger.log("RouterProvisioningWorker initialized");
  }

  async shutdown(): Promise<void> {
    await this.worker?.close();
  }

  // ===========================================================================
  // Job dispatch
  // ===========================================================================

  private async processJob(job: Job<RouterProvisionJobData>): Promise<void> {
    if (job.name !== JOB_NAMES.PROVISION_ROUTER) {
      this.logger.warn(`[Provision] Unknown job name: ${job.name}`);
      return;
    }

    if (job.data.safeOnboard) {
      await this.runSafeOnboarding(job);
    } else {
      await this.runPollOnly(job);
    }
  }

  // ===========================================================================
  // Mode A: Full 5-phase safe onboarding (production router with API access)
  // ===========================================================================

  private async runSafeOnboarding(
    job: Job<RouterProvisionJobData>,
  ): Promise<void> {
    const { routerId, wgIp } = job.data;

    const router = await this.prisma.router.findUnique({
      where: { id: routerId },
      select: {
        name: true,
        apiPort: true,
        apiUsername: true,
        apiPasswordHash: true,
        metadata: true,
      },
    });

    if (!router) {
      this.logger.warn(`[Provision] Router ${routerId} not found — skipping`);
      return;
    }

    const meta = (router.metadata ?? {}) as Record<string, unknown>;
    const localIp =
      (meta.localIp as string | undefined) ??
      (meta.lanIp as string | undefined);

    if (!localIp) {
      this.logger.warn(
        `[Provision] No localIp/lanIp for "${router.name}" — falling back to poll-only mode`,
      );
      return this.runPollOnly(job);
    }

    const wg = (meta.wg ?? {}) as Record<string, string>;
    if (!wg.privateKey || !wg.vpsPublicKey || !wg.endpoint) {
      throw new Error(
        `[Provision] Missing WG metadata (privateKey/vpsPublicKey/endpoint) for router "${router.name}"`,
      );
    }

    await job.updateProgress(5);

    const result = await this.safeOnboarding.onboard({
      routerId,
      routerIp: localIp,
      apiPort: router.apiPort,
      apiUsername: router.apiUsername,
      apiPassword: router.apiPasswordHash,
      wgIp,
      wgPrivateKey: wg.privateKey,
      vpsPublicKey: wg.vpsPublicKey,
      vpsEndpoint: wg.endpoint,
    });

    await job.updateProgress(100);

    if (!result.success) {
      if (result.rollbackRan) {
        // onboard() already ran rollback — also clean up VPS peer
        await removeWireGuardPeer(job.data.routerPublicKey).catch((err) => {
          this.logger.error(
            `[Provision] VPS peer cleanup failed for ${routerId}: ${String(err)}`,
          );
        });
        await this.wgIpPool.release(routerId);
        await this.prisma.router
          .update({
            where: { id: routerId },
            data: {
              status: RouterStatus.OFFLINE,
              metadata: {
                ...meta,
                provisioningError: result.error,
                provisioningFailedAt: new Date().toISOString(),
                onboardingReceipt: JSON.parse(
                  JSON.stringify(result.receipt),
                ) as object,
              },
            },
          })
          .catch(() => {});
      }

      throw new Error(
        `[Provision] Safe onboarding failed for "${router.name}": ${result.error}`,
      );
    }

    // Phase 5 was done inside onboard() — trigger health check
    this.logger.log(
      `[Provision] Safe onboarding complete for "${router.name}" → ${wgIp}`,
    );

    void this.routerApiService.checkRouterHealth(routerId).catch(() => {});
  }

  // ===========================================================================
  // Mode B: Poll-only (mobile pushed WG config, no API access to public IP)
  // ===========================================================================

  private async runPollOnly(job: Job<RouterProvisionJobData>): Promise<void> {
    const { routerId, routerPublicKey, wgIp } = job.data;

    this.logger.log(
      `[Provision][PollOnly] Polling tunnel for router=${routerId} wgIp=${wgIp}`,
    );

    const tunnelUp = await this.pollForTunnel(routerPublicKey, wgIp, job);

    if (!tunnelUp) {
      await this.rollbackPollOnly(routerId, routerPublicKey, wgIp);
      throw new Error(
        `[Provision][PollOnly] Tunnel not established within ` +
          `${(this.POLL_INTERVAL_MS * this.POLL_MAX_ATTEMPTS) / 60_000} min ` +
          `for router ${routerId}`,
      );
    }

    await this.prisma.router.update({
      where: { id: routerId },
      data: { wireguardIp: wgIp },
    });

    this.logger.log(
      `[Provision][PollOnly] Tunnel confirmed — router ${routerId} wireguardIp=${wgIp}`,
    );

    void this.routerApiService.checkRouterHealth(routerId).catch(() => {});
  }

  private async pollForTunnel(
    routerPublicKey: string,
    wgIp: string,
    job: Job<RouterProvisionJobData>,
  ): Promise<boolean> {
    const { isPeerConnected } =
      await import("../../provisioning/wireguard.utils");

    for (let i = 0; i < this.POLL_MAX_ATTEMPTS; i++) {
      await sleep(this.POLL_INTERVAL_MS);

      const connected = await isPeerConnected(routerPublicKey).catch(
        () => false,
      );
      if (connected) return true;

      const pct = Math.round(((i + 1) / this.POLL_MAX_ATTEMPTS) * 100);
      await job.updateProgress(pct).catch(() => {});

      this.logger.debug(
        `[Provision][PollOnly] Poll ${i + 1}/${this.POLL_MAX_ATTEMPTS} ` +
          `wgIp=${wgIp} (${pct}%)`,
      );
    }

    return false;
  }

  private async rollbackPollOnly(
    routerId: string,
    routerPublicKey: string,
    wgIp: string,
  ): Promise<void> {
    this.logger.warn(
      `[Provision][PollOnly] Rollback router=${routerId} wgIp=${wgIp}`,
    );

    await removeWireGuardPeer(routerPublicKey).catch((err) => {
      this.logger.error(`[Provision] VPS peer remove failed: ${String(err)}`);
    });

    await this.wgIpPool.release(routerId);

    await this.prisma.router
      .update({
        where: { id: routerId },
        data: {
          wireguardIp: null,
          status: RouterStatus.OFFLINE,
          metadata: {
            provisioningError: "Tunnel not established within timeout",
            provisioningFailedAt: new Date().toISOString(),
          },
        },
      })
      .catch(() => {});
  }
}
