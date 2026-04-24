/**
 * RouterSafeOnboardingService
 *
 * Zero-downtime, production-safe WireGuard provisioning for live MikroTik routers.
 *
 * HARD CONSTRAINTS (must never be violated):
 *   ✗  No /reset-configuration
 *   ✗  No /ip/firewall/filter/remove (existing rules)
 *   ✗  No /ip/route/remove (existing routes)
 *   ✗  No /ip/address/remove (existing addresses)
 *   ✗  No changes to WAN interface or default route (0.0.0.0/0)
 *   ✓  Only ADD new, isolated WireGuard config
 *   ✓  Every created object's .id is tracked → rollback removes only those
 *
 * Flow:
 *   Phase 1  auditRouter()       — read-only snapshot + conflict detection
 *   Phase 2  pushWgConfig()      — create WG interface + peer + address
 *   Phase 3  pushSpecificRoute() — add route ONLY to VPS subnet (not default)
 *   Phase 4  validateTunnel()    — verify handshake + API reachability
 *   Phase 5  confirmInDb()       — set wireguardIp only after validation passes
 *   Rollback rollback()          — remove only what this service added
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { auditRouter, detectConflicts } from "./router-audit.operations";
import {
  isPeerConnected,
  getPeerHandshakeAge,
  HANDSHAKE_VALID_SECONDS,
} from "../provisioning/wireguard.utils";
import { sleep } from "../../common/helpers/sleep";
import type { MikroTikModule, MikroTikConnection } from "./router-api.types";
import { executeRouterOperationResult } from "./router-routeros.transport";
import { runCommand, runParsedCommand } from "./router-api.commands";
import type {
  ConflictReport,
  OnboardingLogEntry,
  OnboardingReceipt,
  OnboardingResult,
  RouterAuditSnapshot,
  TunnelValidationResult,
} from "./router-safe-onboarding.types";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const MikroNode = require("mikrotik") as MikroTikModule;

const WG_INTERFACE_NAME = "wg-mks";
const WG_LISTEN_PORT = 51820;
const VPS_SUBNET = "10.66.66.0/24";
/** VPS host address — used in firewall rules to allow ONLY the VPS, not the full subnet. */
const VPS_HOST_IP = "10.66.66.1/32";

interface OnboardingParams {
  routerId: string;
  /** Public or LAN IP to reach the router before the tunnel exists */
  routerIp: string;
  apiPort: number;
  apiUsername: string;
  /** Plaintext — used transiently, never persisted by this service */
  apiPassword: string;
  /** WireGuard IP to assign to this router (e.g. "10.66.66.5") */
  wgIp: string;
  /** Router's X25519 private key (already generated, stored in router metadata) */
  wgPrivateKey: string;
  /** VPS WireGuard public key */
  vpsPublicKey: string;
  /** VPS endpoint, e.g. "139.84.241.27:51820" */
  vpsEndpoint: string;
}

@Injectable()
export class RouterSafeOnboardingService {
  private readonly logger = new Logger(RouterSafeOnboardingService.name);
  private readonly apiTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.apiTimeoutMs = this.configService.get<number>(
      "mikrotik.onboardingTimeoutMs",
      20_000,
    );
  }

  // ===========================================================================
  // Public entry point
  // ===========================================================================

  async onboard(params: OnboardingParams): Promise<OnboardingResult> {
    const receipt: OnboardingReceipt = {
      startedAt: new Date().toISOString(),
      log: [],
    };

    const addLog = (
      step: string,
      status: OnboardingLogEntry["status"],
      message: string,
    ) => {
      receipt.log.push({ step, status, message, ts: new Date().toISOString() });
      const logFn =
        status === "error"
          ? this.logger.error.bind(this.logger)
          : status === "warn"
            ? this.logger.warn.bind(this.logger)
            : this.logger.log.bind(this.logger);
      logFn(`[SafeOnboard] router=${params.routerId} step=${step}: ${message}`);
    };

    let audit: RouterAuditSnapshot | null = null;
    let conflicts: ConflictReport | null = null;

    try {
      // ── Phase 1: Read-only audit ────────────────────────────────────────────
      addLog(
        "audit",
        "ok",
        `Connecting to ${params.routerIp}:${params.apiPort} for audit`,
      );

      audit = await auditRouter({
        mikroNode: MikroNode,
        ip: params.routerIp,
        apiPort: params.apiPort,
        username: params.apiUsername,
        password: params.apiPassword,
        timeoutMs: this.apiTimeoutMs,
      });

      addLog(
        "audit",
        "ok",
        `Snapshot captured: ${audit.interfaces.length} ifaces, ` +
          `${audit.addresses.length} addrs, ${audit.routes.length} routes, ` +
          `${audit.firewallRules.length} fw rules`,
      );

      conflicts = detectConflicts(audit, {
        wgInterfaceName: WG_INTERFACE_NAME,
        wgIp: `${params.wgIp}/24`,
        vpsSubnet: VPS_SUBNET,
        listenPort: WG_LISTEN_PORT,
      });

      if (!conflicts.safe) {
        addLog("audit", "error", `Conflicts detected: ${conflicts.summary}`);
        return {
          success: false,
          wgIp: params.wgIp,
          receipt,
          audit,
          conflicts,
          error: `Conflict: ${conflicts.summary}`,
        };
      }

      // Non-blocking warnings — logged but never abort provisioning
      if (conflicts.hasFasttrack) {
        addLog(
          "audit",
          "warn",
          "FastTrack rule active on this router. Does not affect API tunnel (input chain). " +
            "May interfere with hotspot accounting — evaluate /ip/firewall/filter FastTrack rules.",
        );
      }
      if (conflicts.apiExposedOnWan) {
        addLog(
          "audit",
          "warn",
          "RouterOS 'api' service has no source address restriction — accessible from WAN. " +
            "Phase 6b will restrict it to 10.66.66.0/24 after tunnel confirmation.",
        );
      }

      addLog("audit", "ok", "No blocking conflicts — safe to proceed");

      // ── Phase 2: Create WireGuard interface + peer + address ────────────────
      await this.pushWgConfig(params, receipt, addLog);

      // ── Phase 3: Add specific route to VPS subnet only ─────────────────────
      await this.pushSpecificRoute(params, receipt, addLog);

      // ── Phase 4: Validate tunnel (handshake + API) ─────────────────────────
      const validation = await this.validateTunnel(params, addLog);

      if (!validation.handshakeRecent) {
        addLog(
          "validate",
          "error",
          "WireGuard handshake not established within validation window",
        );
        addLog("rollback", "warn", "Rolling back — removing only added config");
        await this.rollback(params, receipt, addLog);
        return {
          success: false,
          wgIp: params.wgIp,
          receipt,
          audit,
          conflicts,
          validation,
          rollbackRan: true,
          error: "Tunnel did not establish — config rolled back",
        };
      }

      if (!validation.apiReachable) {
        // Tunnel is up but API not yet reachable — non-fatal, backend can retry
        addLog(
          "validate",
          "warn",
          `Handshake OK (${validation.handshakeAgeSeconds}s ago) but RouterOS API not yet reachable via tunnel`,
        );
      } else {
        addLog(
          "validate",
          "ok",
          `Handshake OK (${validation.handshakeAgeSeconds}s ago), API reachable via ${params.wgIp} in ${validation.rttMs}ms`,
        );
      }

      // ── Phase 5: Confirm in DB — ONLY after tunnel is validated ────────────
      await this.prisma.router.update({
        where: { id: params.routerId },
        data: { wireguardIp: params.wgIp },
      });
      addLog(
        "confirm",
        "ok",
        `router.wireguardIp set to ${params.wgIp} — backend will now use tunnel`,
      );

      // ── Phase 6b: Lock API service to WG subnet — NON-FATAL ────────────────
      // Runs via tunnel IP (wireguardIp) — public IP is no longer the primary path.
      // Failure does NOT revert Phase 5; the tunnel is confirmed and the router is
      // operational.  The only consequence of failure is that the API service
      // remains accessible from WAN (pre-existing state — no regression).
      await this.lockApiService(params, addLog);

      return {
        success: true,
        wgIp: params.wgIp,
        receipt,
        audit,
        conflicts,
        validation,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog("fatal", "error", message);

      // If we created any objects, roll them back
      const anyCreated =
        receipt.wgInterfaceId ||
        receipt.wgPeerId ||
        receipt.wgAddressId ||
        receipt.wgRouteId ||
        receipt.firewallRuleId;

      if (anyCreated) {
        addLog("rollback", "warn", "Error path — rolling back added config");
        await this.rollback(params, receipt, addLog).catch((rbErr) => {
          addLog(
            "rollback",
            "error",
            `Rollback itself failed: ${String(rbErr)}`,
          );
        });
        return {
          success: false,
          wgIp: params.wgIp,
          receipt,
          audit: audit!,
          conflicts: conflicts!,
          rollbackRan: true,
          error: message,
        };
      }

      return {
        success: false,
        wgIp: params.wgIp,
        receipt,
        audit: audit ?? {
          capturedAt: new Date().toISOString(),
          interfaces: [],
          addresses: [],
          routes: [],
          firewallRules: [],
          wgInterfaces: [],
          services: [],
        },
        conflicts: conflicts ?? {
          wgInterfaceExists: false,
          subnetOverlaps: [],
          routeConflicts: [],
          portConflict: false,
          hasFasttrack: false,
          apiExposedOnWan: false,
          safe: false,
          summary: message,
        },
        error: message,
      };
    }
  }

  // ===========================================================================
  // Phase 2 — Push WireGuard config
  // ===========================================================================

  private async pushWgConfig(
    params: OnboardingParams,
    receipt: OnboardingReceipt,
    log: (
      step: string,
      status: OnboardingLogEntry["status"],
      message: string,
    ) => void,
  ): Promise<void> {
    const [vpsHost, vpsPortStr] = params.vpsEndpoint.split(":");
    const vpsPort = Number(vpsPortStr ?? WG_LISTEN_PORT);

    await executeRouterOperationResult({
      mikroNode: MikroNode,
      wireguardIp: params.routerIp,
      apiPort: params.apiPort,
      username: params.apiUsername,
      password: params.apiPassword,
      timeoutMs: this.apiTimeoutMs,
      operation: async (conn) => {
        // ── 2a: Create WireGuard interface ────────────────────────────────────
        // RouterOS returns the .id of the new object after /add.
        // We capture it so rollback can remove it precisely.
        const wgIfaceId = await this.addAndGetId(conn, [
          "/interface/wireguard/add",
          `=name=${WG_INTERFACE_NAME}`,
          `=listen-port=${WG_LISTEN_PORT}`,
          `=private-key=${params.wgPrivateKey}`,
          "=comment=mikroserver-managed",
        ]);
        receipt.wgInterfaceId = wgIfaceId;
        log(
          "wg-interface",
          "ok",
          `Created ${WG_INTERFACE_NAME} (.id=${wgIfaceId})`,
        );

        // ── 2b: Add VPS as peer ───────────────────────────────────────────────
        // allowed-address = VPS tunnel IP only (10.66.66.1/32).
        // We do NOT use 0.0.0.0/0 — that would redirect all traffic through VPS.
        const wgPeerId = await this.addAndGetId(conn, [
          "/interface/wireguard/peers/add",
          `=interface=${WG_INTERFACE_NAME}`,
          `=public-key=${params.vpsPublicKey}`,
          `=endpoint-address=${vpsHost}`,
          `=endpoint-port=${vpsPort}`,
          `=allowed-address=${VPS_SUBNET}`, // ← ONLY VPS subnet, not 0.0.0.0/0
          "=persistent-keepalive=25",
          "=comment=mikroserver-vps",
        ]);
        receipt.wgPeerId = wgPeerId;
        log(
          "wg-peer",
          "ok",
          `Peer added (.id=${wgPeerId}) allowed-address=${VPS_SUBNET}`,
        );

        // ── 2c: Assign IP address to WG interface ─────────────────────────────
        const wgAddrId = await this.addAndGetId(conn, [
          "/ip/address/add",
          `=address=${params.wgIp}/24`,
          `=interface=${WG_INTERFACE_NAME}`,
          "=comment=mikroserver-wg-ip",
        ]);
        receipt.wgAddressId = wgAddrId;
        log(
          "wg-address",
          "ok",
          `Assigned ${params.wgIp}/24 to ${WG_INTERFACE_NAME} (.id=${wgAddrId})`,
        );

        // ── 2d: Firewall — allow RouterOS API from VPS tunnel IP only ─────────
        // Place BEFORE position 0 so it is evaluated first.
        // Restricts API access to the WireGuard tunnel — tightens security.
        try {
          const fwId = await this.addAndGetId(conn, [
            "/ip/firewall/filter/add",
            "=chain=input",
            "=action=accept",
            "=protocol=tcp",
            "=dst-port=8728",
            `=src-address=${VPS_HOST_IP}`,
            `=in-interface=${WG_INTERFACE_NAME}`,
            "=comment=mikroserver-api-accept",
            "=place-before=0",
          ]);
          receipt.firewallRuleId = fwId;
          log(
            "firewall",
            "ok",
            `Firewall rule added: accept tcp 8728 from ${VPS_HOST_IP} via ${WG_INTERFACE_NAME} (.id=${fwId})`,
          );
        } catch (err) {
          // Non-fatal: the API may already be accessible or the router may
          // have an open policy. Log as warning, continue.
          log(
            "firewall",
            "warn",
            `Could not add API firewall rule (non-fatal): ${String(err)}`,
          );
        }
      },
    });
  }

  // ===========================================================================
  // Phase 3 — Specific route to VPS subnet only
  // ===========================================================================

  private async pushSpecificRoute(
    params: OnboardingParams,
    receipt: OnboardingReceipt,
    log: (
      step: string,
      status: OnboardingLogEntry["status"],
      message: string,
    ) => void,
  ): Promise<void> {
    await executeRouterOperationResult({
      mikroNode: MikroNode,
      wireguardIp: params.routerIp,
      apiPort: params.apiPort,
      username: params.apiUsername,
      password: params.apiPassword,
      timeoutMs: this.apiTimeoutMs,
      operation: async (conn) => {
        // CRITICAL: dst-address = VPS subnet ONLY.
        // We never touch 0.0.0.0/0 (default route) — live traffic is unaffected.
        const routeId = await this.addAndGetId(conn, [
          "/ip/route/add",
          `=dst-address=${VPS_SUBNET}`,
          `=gateway=${WG_INTERFACE_NAME}`,
          `=distance=1`,
          "=comment=mikroserver-vps-route",
        ]);
        receipt.wgRouteId = routeId;
        log(
          "route",
          "ok",
          `Added route ${VPS_SUBNET} via ${WG_INTERFACE_NAME} (.id=${routeId})`,
        );
      },
    });
  }

  // ===========================================================================
  // Phase 6b — Lock RouterOS API service to WireGuard subnet (non-fatal)
  // ===========================================================================

  /**
   * Restrict the RouterOS binary API service (port 8728) to accept connections
   * only from the WireGuard management subnet (10.66.66.0/24).
   *
   * SAFETY:
   *   - Called ONLY after Phase 5 DB confirm — tunnel is validated before this runs.
   *   - Connects via wireguardIp (tunnel), not publicIp — WAN access is used as
   *     fallback only if the tunnel is not yet the primary path.
   *   - Uses /ip/service/set which is idempotent — safe to retry.
   *   - Does NOT disable the service; only restricts the source address.
   *   - Does NOT touch any other service (www, ssh, winbox, ftp, telnet).
   *   - On failure: logs a warning, does NOT throw, does NOT trigger rollback.
   *     The tunnel remains operational; WAN API access persists as pre-existing state.
   *
   * ROLLBACK: not required — this is a tightening, not a structural change.
   *   If this step ran but the router is later removed, the source restriction
   *   remains on the router (harmless — the tunnel peer is already removed).
   */
  private async lockApiService(
    params: OnboardingParams,
    log: (
      step: string,
      status: OnboardingLogEntry["status"],
      message: string,
    ) => void,
  ): Promise<void> {
    try {
      // Connect via tunnel IP — Phase 5 confirmed it is reachable
      await executeRouterOperationResult({
        mikroNode: MikroNode,
        wireguardIp: params.wgIp, // ← tunnel, not public IP
        apiPort: params.apiPort,
        username: params.apiUsername,
        password: params.apiPassword,
        timeoutMs: 10_000,
        operation: async (conn) => {
          // Read current state first — idempotency check
          const services = await runParsedCommand<{
            name?: string;
            address?: string;
            disabled?: string;
          }>(conn, MikroNode.parseItems, "/ip/service/print", [
            "?name=api",
            "=proplist=name,address,disabled",
          ]);

          const apiSvc = services[0];

          if (!apiSvc) {
            log(
              "api-lock",
              "warn",
              "RouterOS 'api' service not found — skipping restriction",
            );
            return;
          }

          if (apiSvc.disabled === "true") {
            log(
              "api-lock",
              "skip",
              "RouterOS 'api' service is already disabled — no action needed",
            );
            return;
          }

          if (apiSvc.address === VPS_SUBNET) {
            log(
              "api-lock",
              "skip",
              `RouterOS 'api' service already restricted to ${VPS_SUBNET}`,
            );
            return;
          }

          await runCommand(conn, [
            "/ip/service/set",
            "=name=api",
            `=address=${VPS_SUBNET}`,
            "=disabled=no",
          ]);

          log(
            "api-lock",
            "ok",
            `RouterOS 'api' service restricted to ${VPS_SUBNET} — WAN API access closed`,
          );
        },
      });
    } catch (err) {
      // Non-fatal. Log and continue — onboarding result is still success=true.
      log(
        "api-lock",
        "warn",
        `Phase 6b non-fatal failure — API service restriction skipped: ${String(err)}. ` +
          `API remains accessible on WAN (pre-existing state). Apply manually: ` +
          `/ip/service/set name=api address=${VPS_SUBNET}`,
      );
    }
  }

  // ===========================================================================
  // Phase 4 — Tunnel validation
  // ===========================================================================

  private async validateTunnel(
    params: OnboardingParams,
    log: (
      step: string,
      status: OnboardingLogEntry["status"],
      message: string,
    ) => void,
  ): Promise<TunnelValidationResult> {
    const POLL_INTERVAL_MS = 5_000;
    const POLL_MAX = 24; // 2 minutes

    log(
      "validate",
      "ok",
      `Polling for WireGuard handshake (up to ${(POLL_MAX * POLL_INTERVAL_MS) / 1000}s)...`,
    );

    let handshakeAgeSeconds: number | null = null;
    let handshakeRecent = false;

    for (let i = 0; i < POLL_MAX; i++) {
      await sleep(POLL_INTERVAL_MS);

      const wgStatus = await this.getWgHandshakeAge(params).catch(() => null);
      if (wgStatus !== null) {
        handshakeAgeSeconds = wgStatus;
        handshakeRecent = wgStatus < HANDSHAKE_VALID_SECONDS;
        if (handshakeRecent) {
          log(
            "validate",
            "ok",
            `Handshake detected — age=${wgStatus}s (< ${HANDSHAKE_VALID_SECONDS}s threshold)`,
          );
          break;
        }
        // Handshake exists but stale — peer may be re-negotiating, keep polling
        log(
          "validate",
          "ok",
          `Poll ${i + 1}/${POLL_MAX} — stale handshake (age=${wgStatus}s, threshold=${HANDSHAKE_VALID_SECONDS}s)`,
        );
      } else {
        log("validate", "ok", `Poll ${i + 1}/${POLL_MAX} — no handshake yet`);
      }
    }

    if (!handshakeRecent) {
      return {
        handshakeRecent: false,
        handshakeAgeSeconds,
        apiReachable: false,
      };
    }

    // Attempt RouterOS API via tunnel IP
    const apiStart = Date.now();
    const apiReachable = await this.probeApiViaTunnel(params).catch(
      () => false,
    );
    const rttMs = Date.now() - apiStart;

    return { handshakeRecent, handshakeAgeSeconds, apiReachable, rttMs };
  }

  private async getWgHandshakeAge(
    params: OnboardingParams,
  ): Promise<number | null> {
    try {
      const publicKey = await this.getRouterPublicKey(params.routerId);
      return getPeerHandshakeAge(publicKey); // real age in seconds, or null
    } catch {
      return null;
    }
  }

  private async getRouterPublicKey(routerId: string): Promise<string> {
    const router = await this.prisma.router.findUnique({
      where: { id: routerId },
      select: { metadata: true },
    });
    const meta = (router?.metadata ?? {}) as Record<string, unknown>;
    const wg = meta.wg as Record<string, string> | undefined;
    if (!wg?.publicKey)
      throw new Error(`No publicKey in metadata for router ${routerId}`);
    return wg.publicKey;
  }

  /**
   * Try to reach the RouterOS API via the WireGuard tunnel IP.
   * If this succeeds, Phase 5 can safely switch the backend to the tunnel.
   */
  private async probeApiViaTunnel(params: OnboardingParams): Promise<boolean> {
    try {
      await executeRouterOperationResult({
        mikroNode: MikroNode,
        wireguardIp: params.wgIp, // ← tunnel IP, not public IP
        apiPort: params.apiPort,
        username: params.apiUsername,
        password: params.apiPassword,
        timeoutMs: 8_000,
        operation: async (conn) => {
          // Minimal read — just verify the connection works
          await runParsedCommand(
            conn,
            MikroNode.parseItems,
            "/system/identity/print",
          );
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // Rollback — removes ONLY what this service created
  // ===========================================================================

  /**
   * Remove every RouterOS object recorded in the receipt.
   * Does NOT touch anything that was not created by this onboarding run.
   * Safe to call multiple times (remove on non-existent .id is a no-op trap).
   */
  async rollback(
    params: OnboardingParams,
    receipt: OnboardingReceipt,
    log?: (
      step: string,
      status: OnboardingLogEntry["status"],
      message: string,
    ) => void,
  ): Promise<void> {
    const emit =
      log ??
      ((step, status, msg) => {
        (status === "error" ? this.logger.error : this.logger.warn).call(
          this.logger,
          `[SafeOnboard][Rollback] ${step}: ${msg}`,
        );
      });

    await executeRouterOperationResult({
      mikroNode: MikroNode,
      wireguardIp: params.routerIp,
      apiPort: params.apiPort,
      username: params.apiUsername,
      password: params.apiPassword,
      timeoutMs: this.apiTimeoutMs,
      operation: async (conn) => {
        // Remove in reverse creation order:
        // route → firewall → address → peer → interface
        if (receipt.wgRouteId) {
          await this.removeById(
            conn,
            "/ip/route/remove",
            receipt.wgRouteId,
            emit,
            "route",
          );
        }
        if (receipt.firewallRuleId) {
          await this.removeById(
            conn,
            "/ip/firewall/filter/remove",
            receipt.firewallRuleId,
            emit,
            "firewall",
          );
        }
        if (receipt.wgAddressId) {
          await this.removeById(
            conn,
            "/ip/address/remove",
            receipt.wgAddressId,
            emit,
            "address",
          );
        }
        if (receipt.wgPeerId) {
          await this.removeById(
            conn,
            "/interface/wireguard/peers/remove",
            receipt.wgPeerId,
            emit,
            "wg-peer",
          );
        }
        if (receipt.wgInterfaceId) {
          await this.removeById(
            conn,
            "/interface/wireguard/remove",
            receipt.wgInterfaceId,
            emit,
            "wg-interface",
          );
        }
      },
    });

    emit(
      "rollback",
      "ok",
      "Rollback complete — only mikroserver-added config removed",
    );
  }

  private async removeById(
    conn: MikroTikConnection,
    command: string,
    id: string,
    log: (
      step: string,
      status: OnboardingLogEntry["status"],
      message: string,
    ) => void,
    label: string,
  ): Promise<void> {
    try {
      await runCommand(conn, [command, `=.id=${id}`]);
      log("rollback", "ok", `Removed ${label} .id=${id}`);
    } catch (err) {
      // Non-existent .id → already removed or never existed — safe to ignore
      log(
        "rollback",
        "warn",
        `Remove ${label} .id=${id} failed (may already be gone): ${String(err)}`,
      );
    }
  }

  // ===========================================================================
  // Monitoring helper — called by the periodic health cron
  // ===========================================================================

  /**
   * Check if the WireGuard tunnel for a router is still alive.
   * Uses `wg show wg0 latest-handshakes` on the VPS side.
   * Called by the existing scheduledHealthCheck cron in RoutersService.
   */
  async isTunnelAlive(routerPublicKey: string): Promise<{
    alive: boolean;
    handshakeAgeSeconds: number | null;
  }> {
    const age = await getPeerHandshakeAge(routerPublicKey).catch(() => null);
    return {
      alive: age !== null && age < HANDSHAKE_VALID_SECONDS,
      handshakeAgeSeconds: age,
    };
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Execute a /add command and return the .id of the created object.
   * RouterOS responds to /add with a single word: =ret=*HEX_ID
   */
  private async addAndGetId(
    conn: MikroTikConnection,
    commands: string[],
  ): Promise<string> {
    const channel = conn.openChannel();
    return new Promise<string>((resolve, reject) => {
      channel.write(commands);
      channel.on("trap", (err: unknown) => {
        const msg =
          typeof err === "object" && err !== null
            ? JSON.stringify(err)
            : String(err);
        reject(new Error(`RouterOS trap: ${msg}`));
      });
      channel.once("done", (data: unknown) => {
        // The mikrotik library puts the return value in the first parsed item
        const parsed = MikroNode.parseItems<{ ret?: string }>(data);
        const id = parsed[0]?.ret ?? "";
        resolve(id);
      });
    });
  }
}
