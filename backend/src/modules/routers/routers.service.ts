import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import {
  RouterApiService,
  RouterBandwidthStats,
  RouterHotspotIpBinding,
  RouterHotspotUser,
  RouterHotspotUserProfile,
  RouterHotspotUserProfileUpdateResult,
  RouterLiveStats,
  RouterSyncSummary,
} from "./router-api.service";
import { AuditService } from "../audit/audit.service";
import {
  BulkRouterActionDto,
  CreateHotspotIpBindingDto,
  CreateHotspotUserProfileDto,
  CreateRouterDto,
  ListHotspotUsersQueryDto,
  ListRoutersQueryDto,
  UpdateHotspotIpBindingDto,
  UpdateHotspotUserProfileConfigDto,
  UpdateHotspotUserProfileDto,
  UpdateRouterDto,
} from "./dto/router.dto";
import {
  Router,
  AuditAction,
  RouterStatus,
  VoucherStatus,
  GenerationType,
} from "@prisma/client";
import { randomBytes } from "crypto";
import {
  generateWireGuardKeyPair,
  addWireGuardPeer,
  getVpsPublicKey,
  isPeerConnected,
} from "../provisioning/wireguard.utils";
import { executeRouterOperationResult } from "./router-routeros.transport";
import { runCommand, runParsedCommand } from "./router-api.commands";
import type { MikroTikModule } from "./router-api.types";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const MikroNode = require("mikrotik") as MikroTikModule;

const WG_SUBNET = "10.66.66";
const WG_SERVER_IP = "10.66.66.1";
const WG_LISTEN_PORT = 51820;

// site and tags are now first-class columns on Router — no longer in metadata.
type RouterSafeView = Omit<Router, "apiPasswordHash">;

type BulkActionResultItem = {
  routerId: string;
  routerName: string;
  message: string;
};

type BulkActionErrorItem = {
  routerId: string;
  routerName: string;
  error: string;
};

@Injectable()
export class RoutersService {
  private readonly logger = new Logger(RoutersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly routerApiService: RouterApiService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Periodic background health check — every 5 minutes
  // Keeps router statuses up-to-date without requiring UI interaction.
  // Uses Promise.allSettled so a single failing router cannot block others.
  // ---------------------------------------------------------------------------

  @Cron("0 */5 * * * *") // Every 5 minutes
  async scheduledHealthCheck(): Promise<void> {
    const routers = await this.prisma.router.findMany({
      where: {
        deletedAt: null,
        status: { not: RouterStatus.MAINTENANCE },
      },
      select: { id: true, name: true },
    });

    if (routers.length === 0) return;

    this.logger.debug(
      `[HealthCheck] Starting periodic check for ${routers.length} router(s)`,
    );

    const results = await Promise.allSettled(
      routers.map((router) =>
        this.routerApiService.checkRouterHealth(router.id),
      ),
    );

    const failures = results.filter((r) => r.status === "rejected").length;
    if (failures > 0) {
      this.logger.warn(
        `[HealthCheck] ${failures}/${routers.length} health check(s) failed`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Periodic hotspot sync — every 10 minutes on ONLINE routers
  // Auto-disconnects expired sessions on MikroTik without manual intervention.
  // ---------------------------------------------------------------------------

  @Cron("0 */10 * * * *") // Every 10 minutes
  async scheduledHotspotSync(): Promise<void> {
    const routers = await this.prisma.router.findMany({
      where: {
        deletedAt: null,
        status: RouterStatus.ONLINE,
      },
      select: { id: true, name: true },
    });

    if (routers.length === 0) return;

    this.logger.debug(
      `[AutoSync] Starting periodic hotspot sync for ${routers.length} router(s)`,
    );

    const results = await Promise.allSettled(
      routers.map((router) => this.routerApiService.syncRouterState(router.id)),
    );

    const successes = results.filter((r) => r.status === "fulfilled").length;
    const failures = results.filter((r) => r.status === "rejected").length;
    if (failures > 0) {
      this.logger.warn(
        `[AutoSync] ${failures}/${routers.length} sync(s) failed, ${successes} succeeded`,
      );
    } else {
      this.logger.debug(
        `[AutoSync] All ${successes} router(s) synced successfully`,
      );
    }
  }

  async findAll(
    filters: ListRoutersQueryDto = {},
    requestingUserId?: string,
    requestingUserRole?: string,
  ): Promise<RouterSafeView[]> {
    // SUPER_ADMIN sees all routers; every other role is scoped to their own.
    const ownerFilter =
      requestingUserRole === "SUPER_ADMIN"
        ? {}
        : requestingUserId
          ? { ownerId: requestingUserId }
          : { id: "" }; // No userId → empty result (should not happen in practice)

    const statusFilter = filters.status ? { status: filters.status } : {};
    const siteFilter = filters.site
      ? { site: { equals: filters.site.trim(), mode: "insensitive" as const } }
      : {};
    const tagFilter = filters.tag ? { tags: { has: filters.tag.trim() } } : {};

    const routers = await this.prisma.router.findMany({
      where: {
        deletedAt: null,
        ...ownerFilter,
        ...statusFilter,
        ...siteFilter,
        ...tagFilter,
      },
      orderBy: { name: "asc" },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Search filter remains in-memory (multi-field text search across name/location/ip/tags).
    return routers
      .map((router) => this.sanitizeRouter(router))
      .filter((router) => this.matchesSearchFilter(router, filters.search));
  }

  async findPublicInfo(
    id: string,
  ): Promise<{ id: string; name: string; hotspotServer: string }> {
    const router = await this.prisma.router.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, name: true, hotspotServer: true },
    });
    if (!router) throw new NotFoundException(`Router ${id} not found`);
    return router;
  }

  async findOne(
    id: string,
    requestingUserId?: string,
    requestingUserRole?: string,
  ): Promise<RouterSafeView> {
    const ownerFilter =
      requestingUserRole === "SUPER_ADMIN"
        ? {}
        : requestingUserId
          ? { ownerId: requestingUserId }
          : {};

    const router = await this.prisma.router.findUnique({
      where: { id, deletedAt: null, ...ownerFilter },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!router) throw new NotFoundException(`Router ${id} not found`);
    return this.sanitizeRouter(router);
  }

  async create(
    dto: CreateRouterDto,
    adminId: string,
    requestingUserRole?: string,
  ): Promise<RouterSafeView & { wgProvision: { privateKey: string; wgIp: string; vpsPublicKey: string; vpsEndpoint: string; listenPort: number } }> {
    // Check for existing router with same name (including deleted ones)
    // Note: wireguardIp from form is the local IP stored in metadata; DB wireguardIp is assigned by WG provisioning
    const existing = await this.prisma.router.findFirst({
      where: { name: dto.name },
    });

    if (existing) {
      if (existing.deletedAt === null) {
        throw new ConflictException(`Un serveur avec ce Nom existe déjà.`);
      }

      // Re-activate and update soft-deleted router
      const localIp = dto.wireguardIp ?? null;
      const restored = await this.prisma.router.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          description: dto.description,
          location: dto.location,
          wireguardIp: null, // will be set by WG provisioning
          apiPort: dto.apiPort ?? 8728,
          apiUsername: dto.apiUsername,
          apiPasswordHash: dto.apiPassword,
          hotspotProfile: dto.hotspotProfile ?? "default",
          hotspotServer: dto.hotspotServer ?? "hotspot1",
          site: dto.site?.trim() || null,
          tags: this.normalizeTags(dto.tags),
          metadata: { localIp },
          deletedAt: null,
          status: RouterStatus.OFFLINE,
        },
      });

      await this.auditService.log({
        userId: adminId,
        action: AuditAction.UPDATE,
        entityType: "Router",
        entityId: restored.id,
        description: `Router "${restored.name}" restored${localIp ? ` (local IP: ${localIp})` : ""}`,
      });

      // Generate WG config for mobile to push directly to router
      const wgProvision = await this.generateWgProvision(restored.id);
      const view = await this.findOne(restored.id);
      return { ...view, wgProvision };
    }

    // ADMIN users automatically own the router they create
    const resolvedOwnerId =
      dto.ownerId ?? (requestingUserRole === "ADMIN" ? adminId : undefined);

    const localIp = dto.wireguardIp ?? null;

    const router = await this.prisma.router.create({
      data: {
        name: dto.name,
        description: dto.description,
        location: dto.location,
        wireguardIp: null, // will be set once WireGuard tunnel establishes
        apiPort: dto.apiPort ?? 8728,
        apiUsername: dto.apiUsername,
        apiPasswordHash: dto.apiPassword,
        hotspotProfile: dto.hotspotProfile ?? "default",
        hotspotServer: dto.hotspotServer ?? "hotspot1",
        site: dto.site?.trim() || null,
        tags: this.normalizeTags(dto.tags),
        metadata: { localIp },
        ...(resolvedOwnerId ? { ownerId: resolvedOwnerId } : {}),
      },
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.CREATE,
      entityType: "Router",
      entityId: router.id,
      description: `Router "${router.name}" added${localIp ? ` (local IP: ${localIp})` : ""}`,
    });

    // Generate WG config synchronously — mobile will push it to the router directly
    const wgProvision = await this.generateWgProvision(router.id);
    const view = await this.findOne(router.id);
    return { ...view, wgProvision };
  }

  /**
   * Generate WireGuard keys, add VPS peer, save to DB, start polling for tunnel.
   * Returns config that the mobile app will push to the router via RouterOS REST API.
   */
  private async generateWgProvision(routerId: string): Promise<{
    privateKey: string; wgIp: string; vpsPublicKey: string; vpsEndpoint: string; listenPort: number;
  }> {
    const wgIp = await this.assignNextWgIp();
    const { privateKey, publicKey } = await generateWireGuardKeyPair();
    const vpsPublicKey = await getVpsPublicKey();
    const vpsEndpoint =
      this.configService.get<string>("WG_SERVER_ENDPOINT") ??
      `${this.configService.get<string>("HOST") ?? "139.84.241.27"}:${WG_LISTEN_PORT}`;

    await addWireGuardPeer(publicKey, wgIp);

    await this.prisma.router.update({
      where: { id: routerId },
      data: {
        metadata: {
          wg: { wgIp, privateKey, publicKey, vpsPublicKey, endpoint: vpsEndpoint, listenPort: WG_LISTEN_PORT, provisionedAt: new Date().toISOString() },
        },
      },
    });

    // Poll for tunnel in background (mobile will push config → tunnel should connect)
    void this.pollForTunnel(routerId, publicKey, wgIp).catch(() => {});

    return { privateKey, wgIp, vpsPublicKey, vpsEndpoint, listenPort: WG_LISTEN_PORT };
  }

  private async pollForTunnel(routerId: string, publicKey: string, wgIp: string): Promise<void> {
    for (let i = 0; i < 36; i++) { // 3 minutes
      await new Promise<void>((r) => setTimeout(r, 5000));
      if (await isPeerConnected(publicKey)) {
        await this.prisma.router.update({ where: { id: routerId }, data: { wireguardIp: wgIp } });
        this.logger.log(`[WG] Tunnel established → ${wgIp}`);
        void this.routerApiService.checkRouterHealth(routerId).catch(() => {});
        return;
      }
    }
    this.logger.warn(`[WG] Tunnel not established within 3min for router ${routerId}`);
  }

  async update(
    id: string,
    dto: UpdateRouterDto,
    adminId: string,
  ): Promise<RouterSafeView> {
    const existing = await this.findOne(id);

    if (dto.name || dto.wireguardIp) {
      const conflict = await this.prisma.router.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(dto.name ? [{ name: dto.name }] : []),
            ...(dto.wireguardIp ? [{ wireguardIp: dto.wireguardIp }] : []),
          ],
        },
      });

      if (conflict?.deletedAt === null) {
        const conflictField =
          conflict.wireguardIp === dto.wireguardIp ? "IP" : "Nom";
        throw new ConflictException(
          `Un serveur avec ce ${conflictField} existe déjà.`,
        );
      }
    }

    const { apiPassword, site, tags, ownerId, ...rest } =
      dto as UpdateRouterDto & { apiPassword?: string };
    const updateData: Record<string, unknown> = { ...rest };
    if (apiPassword) updateData["apiPasswordHash"] = apiPassword;
    if (ownerId !== undefined) updateData["ownerId"] = ownerId;
    if (Object.prototype.hasOwnProperty.call(dto, "site")) {
      updateData["site"] = site?.trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, "tags")) {
      updateData["tags"] = this.normalizeTags(tags);
    }

    const updated = await this.prisma.router.update({
      where: { id },
      data: updateData,
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "Router",
      entityId: id,
      oldValues: existing as unknown as Record<string, unknown>,
      newValues: dto,
    });

    await this.routerApiService.checkRouterHealth(id);
    return this.findOne(id);
  }

  async bulkAction(
    dto: BulkRouterActionDto,
    adminId: string,
  ): Promise<{
    action: BulkRouterActionDto["action"];
    processed: BulkActionResultItem[];
    failed: BulkActionErrorItem[];
    processedCount: number;
    failedCount: number;
  }> {
    const uniqueIds = Array.from(new Set(dto.routerIds));
    const routers = await this.prisma.router.findMany({
      where: { id: { in: uniqueIds }, deletedAt: null },
      orderBy: { name: "asc" },
    });

    const processed: BulkActionResultItem[] = [];
    const failed: BulkActionErrorItem[] = [];
    const foundIds = new Set(routers.map((router) => router.id));

    for (const missingId of uniqueIds.filter((id) => !foundIds.has(id))) {
      failed.push({
        routerId: missingId,
        routerName: "Routeur introuvable",
        error: "Routeur introuvable ou deja supprime.",
      });
    }

    for (const router of routers) {
      try {
        switch (dto.action) {
          case "HEALTH_CHECK": {
            const result = await this.routerApiService.checkRouterHealth(
              router.id,
            );
            processed.push({
              routerId: router.id,
              routerName: router.name,
              message: result.online
                ? "Routeur joignable et mis a jour."
                : (result.error ?? "Routeur verifie."),
            });
            break;
          }
          case "SYNC": {
            const summary = await this.routerApiService.syncRouterState(
              router.id,
            );
            processed.push({
              routerId: router.id,
              routerName: router.name,
              message: `${summary.activeClients} client(s) actifs, ${summary.unmatchedUsers.length} utilisateur(s) non apparies.`,
            });
            break;
          }
          case "ENABLE_MAINTENANCE":
          case "DISABLE_MAINTENANCE": {
            const nextStatus =
              dto.action === "ENABLE_MAINTENANCE"
                ? RouterStatus.MAINTENANCE
                : RouterStatus.ONLINE;
            await this.prisma.router.update({
              where: { id: router.id },
              data: { status: nextStatus },
            });
            processed.push({
              routerId: router.id,
              routerName: router.name,
              message:
                dto.action === "ENABLE_MAINTENANCE"
                  ? "Passe en maintenance."
                  : "Retire de la maintenance.",
            });
            break;
          }
        }
      } catch (error) {
        failed.push({
          routerId: router.id,
          routerName: router.name,
          error: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }
    }

    await this.auditService.log({
      userId: adminId,
      action:
        dto.action === "HEALTH_CHECK" || dto.action === "SYNC"
          ? AuditAction.CONFIG_CHANGED
          : AuditAction.UPDATE,
      entityType: "RouterBulkAction",
      entityId: dto.action,
      newValues: {
        routerIds: uniqueIds,
        processedCount: processed.length,
        failedCount: failed.length,
      },
      description: `Bulk action ${dto.action} executed on ${uniqueIds.length} routeur(s).`,
    });

    return {
      action: dto.action,
      processed,
      failed,
      processedCount: processed.length,
      failedCount: failed.length,
    };
  }

  async remove(id: string, adminId: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.router.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.routerApiService.evictCircuitBreaker(id);
    await this.auditService.log({
      userId: adminId,
      action: AuditAction.DELETE,
      entityType: "Router",
      entityId: id,
      description: `Router ${id} deleted`,
    });
  }

  async healthCheck(
    id: string,
  ): Promise<{ online: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    const result = await this.routerApiService.checkRouterHealth(id);
    const latencyMs = Date.now() - start;
    return { online: result.online, latencyMs, error: result.error };
  }

  async getLiveStats(id: string): Promise<RouterLiveStats> {
    return this.routerApiService.getLiveStats(id);
  }

  async getWebfigSession(
    id: string,
    requestingUserId: string,
    requestingUserRole: string,
  ): Promise<{ proxyUrl: string; port: number }> {
    const router = await this.findOne(id, requestingUserId, requestingUserRole);
    if (!router.wireguardIp) {
      throw new Error("Router has no WireGuard IP assigned");
    }
    const lastOctet = parseInt(router.wireguardIp.split(".")[3], 10);
    if (isNaN(lastOctet) || lastOctet < 2 || lastOctet > 254) {
      throw new Error(
        `WebFig proxy not available for WireGuard IP ${router.wireguardIp}`,
      );
    }
    // Ensure WebFig is reachable before returning URL — fire-and-forget on failure
    await this.ensureWebfigEnabled(id).catch((err: unknown) => {
      this.logger.warn(`[WebFig] Pre-check failed for ${id}: ${String(err)}`);
    });
    const vpsIp = this.configService.get<string>(
      "VPS_PUBLIC_IP",
      "139.84.241.27",
    );
    const port = 9000 + lastOctet;
    return { proxyUrl: `http://${vpsIp}:${port}`, port };
  }

  /**
   * Idempotent: enables the www service on port 80 restricted to the WireGuard
   * subnet and ensures the input-chain firewall accept rule exists.
   * Retries once on transient failures. Never throws — caller decides how to handle.
   */
  private async ensureWebfigEnabled(routerId: string): Promise<void> {
    const router = await this.prisma.router.findUnique({
      where: { id: routerId, deletedAt: null },
      select: {
        wireguardIp: true,
        apiPort: true,
        apiUsername: true,
        apiPasswordHash: true,
      },
    });
    if (!router?.wireguardIp) return;

    const maxAttempts = 2;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await executeRouterOperationResult({
          mikroNode: MikroNode,
          wireguardIp: router.wireguardIp,
          apiPort: router.apiPort,
          username: router.apiUsername,
          password: router.apiPasswordHash,
          timeoutMs: 12000,
          operation: async (conn) => {
            // Auto-detect WireGuard interface name (prefer wg-mks, fallback to first)
            const wgIfaces = await runParsedCommand<{ name?: string }>(
              conn,
              MikroNode.parseItems,
              "/interface/wireguard/print",
            );
            const wgIface =
              wgIfaces.find((i) => i.name === "wg-mks")?.name ??
              wgIfaces[0]?.name ??
              "wg-mks";

            // Check www service state
            const services = await runParsedCommand<{
              name?: string;
              disabled?: string;
              port?: string;
              address?: string;
            }>(conn, MikroNode.parseItems, "/ip/service/print", [
              "?name=www",
            ]);
            const www = services[0];
            const needsServiceUpdate =
              !www ||
              www.disabled !== "false" ||
              www.port !== "80" ||
              www.address !== "10.66.66.0/24";

            if (needsServiceUpdate) {
              await runCommand(conn, [
                "/ip/service/set",
                "=name=www",
                "=disabled=no",
                "=port=80",
                "=address=10.66.66.0/24",
              ]);
              this.logger.log(
                `[WebFig] www service configured on router ${routerId}`,
              );
            }

            // Check for existing firewall accept rule
            const rules = await runParsedCommand<{
              ".id"?: string;
              comment?: string;
            }>(conn, MikroNode.parseItems, "/ip/firewall/filter/print", [
              "?comment=auto-webfig",
            ]);

            if (rules.length === 0) {
              await runCommand(conn, [
                "/ip/firewall/filter/add",
                "=chain=input",
                "=action=accept",
                "=protocol=tcp",
                "=dst-port=80",
                `=in-interface=${wgIface}`,
                "=comment=auto-webfig",
                "=place-before=0",
              ]);
              this.logger.log(
                `[WebFig] Firewall rule added on router ${routerId} (iface=${wgIface})`,
              );
            }
          },
        });
        return; // success
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts) {
          await new Promise<void>((r) => setTimeout(r, 2000));
        }
      }
    }

    throw lastErr;
  }

  async getBandwidthStats(id: string): Promise<RouterBandwidthStats> {
    await this.findOne(id);
    return this.routerApiService.getBandwidthStats(id);
  }

  async sync(id: string): Promise<RouterSyncSummary> {
    await this.findOne(id);
    return this.routerApiService.syncRouterState(id);
  }

  async getHotspotUserProfiles(
    id: string,
  ): Promise<RouterHotspotUserProfile[]> {
    await this.findOne(id);
    return this.routerApiService.getHotspotUserProfiles(id);
  }

  async createHotspotUserProfile(
    id: string,
    dto: CreateHotspotUserProfileDto,
    adminId: string,
  ): Promise<RouterHotspotUserProfile> {
    await this.findOne(id);
    const result = await this.routerApiService.createHotspotUserProfile(id, {
      name: dto.name,
      rateLimit: dto.rateLimit,
      sharedUsers: dto.sharedUsers,
      sessionTimeout: dto.sessionTimeout,
      idleTimeout: dto.idleTimeout,
      keepaliveTimeout: dto.keepaliveTimeout,
      addressPool: dto.addressPool,
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.CREATE,
      entityType: "RouterHotspotUserProfile",
      entityId: `${id}:${result.id}`,
      newValues: dto as unknown as Record<string, unknown>,
      description: `Profil hotspot ${result.name} cree sur le routeur ${id}.`,
    });

    return result;
  }

  async updateHotspotUserProfileConfig(
    id: string,
    profileId: string,
    dto: UpdateHotspotUserProfileConfigDto,
    adminId: string,
  ): Promise<RouterHotspotUserProfile> {
    await this.findOne(id);
    const result = await this.routerApiService.updateHotspotUserProfileConfig(
      id,
      {
        profileId,
        name: dto.name,
        rateLimit: dto.rateLimit,
        sharedUsers: dto.sharedUsers,
        sessionTimeout: dto.sessionTimeout,
        idleTimeout: dto.idleTimeout,
        keepaliveTimeout: dto.keepaliveTimeout,
        addressPool: dto.addressPool,
      },
    );

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "RouterHotspotUserProfile",
      entityId: `${id}:${profileId}`,
      newValues: dto as unknown as Record<string, unknown>,
      description: `Profil hotspot ${profileId} mis a jour sur le routeur ${id}.`,
    });

    return result;
  }

  async removeHotspotUserProfile(
    id: string,
    profileId: string,
    adminId: string,
  ): Promise<void> {
    await this.findOne(id);
    await this.routerApiService.removeHotspotUserProfile(id, profileId);

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.DELETE,
      entityType: "RouterHotspotUserProfile",
      entityId: `${id}:${profileId}`,
      description: `Profil hotspot ${profileId} supprime sur le routeur ${id}.`,
    });
  }

  async getHotspotIpBindings(id: string): Promise<RouterHotspotIpBinding[]> {
    await this.findOne(id);
    return this.routerApiService.getHotspotIpBindings(id);
  }

  async createHotspotIpBinding(
    id: string,
    dto: CreateHotspotIpBindingDto,
    adminId: string,
  ): Promise<RouterHotspotIpBinding> {
    await this.findOne(id);
    const result = await this.routerApiService.createHotspotIpBinding(id, {
      server: dto.server,
      address: dto.address,
      macAddress: dto.macAddress,
      type: dto.type,
      comment: dto.comment,
      toAddress: dto.toAddress,
      addressList: dto.addressList,
      disabled: dto.disabled,
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.CREATE,
      entityType: "RouterHotspotIpBinding",
      entityId: `${id}:${result.id}`,
      newValues: dto as unknown as Record<string, unknown>,
      description: `IP binding ${result.id} cree sur le routeur ${id}.`,
    });

    return result;
  }

  async updateHotspotIpBinding(
    id: string,
    bindingId: string,
    dto: UpdateHotspotIpBindingDto,
    adminId: string,
  ): Promise<RouterHotspotIpBinding> {
    await this.findOne(id);
    const result = await this.routerApiService.updateHotspotIpBinding(id, {
      bindingId,
      server: dto.server,
      address: dto.address,
      macAddress: dto.macAddress,
      type: dto.type,
      comment: dto.comment,
      toAddress: dto.toAddress,
      addressList: dto.addressList,
      disabled: dto.disabled,
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "RouterHotspotIpBinding",
      entityId: `${id}:${bindingId}`,
      newValues: dto as unknown as Record<string, unknown>,
      description: `IP binding ${bindingId} mis a jour sur le routeur ${id}.`,
    });

    return result;
  }

  async removeHotspotIpBinding(
    id: string,
    bindingId: string,
    adminId: string,
  ): Promise<void> {
    await this.findOne(id);
    await this.routerApiService.removeHotspotIpBinding(id, bindingId);

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.DELETE,
      entityType: "RouterHotspotIpBinding",
      entityId: `${id}:${bindingId}`,
      description: `IP binding ${bindingId} supprime sur le routeur ${id}.`,
    });
  }

  async blockHotspotIpBinding(
    id: string,
    bindingId: string,
    adminId: string,
  ): Promise<RouterHotspotIpBinding> {
    await this.findOne(id);
    const result = await this.routerApiService.setHotspotIpBindingBlocked(
      id,
      bindingId,
      true,
    );

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "RouterHotspotIpBinding",
      entityId: `${id}:${bindingId}`,
      newValues: { type: "blocked" },
      description: `IP binding ${bindingId} bloque sur le routeur ${id}.`,
    });

    return result;
  }

  async unblockHotspotIpBinding(
    id: string,
    bindingId: string,
    adminId: string,
  ): Promise<RouterHotspotIpBinding> {
    await this.findOne(id);
    const result = await this.routerApiService.setHotspotIpBindingBlocked(
      id,
      bindingId,
      false,
    );

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "RouterHotspotIpBinding",
      entityId: `${id}:${bindingId}`,
      newValues: { type: "regular" },
      description: `IP binding ${bindingId} debloque sur le routeur ${id}.`,
    });

    return result;
  }

  async enableHotspotIpBinding(
    id: string,
    bindingId: string,
    adminId: string,
  ): Promise<RouterHotspotIpBinding> {
    await this.findOne(id);
    const result = await this.routerApiService.setHotspotIpBindingDisabled(
      id,
      bindingId,
      false,
    );

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "RouterHotspotIpBinding",
      entityId: `${id}:${bindingId}`,
      newValues: { disabled: false },
      description: `IP binding ${bindingId} active sur le routeur ${id}.`,
    });

    return result;
  }

  async disableHotspotIpBinding(
    id: string,
    bindingId: string,
    adminId: string,
  ): Promise<RouterHotspotIpBinding> {
    await this.findOne(id);
    const result = await this.routerApiService.setHotspotIpBindingDisabled(
      id,
      bindingId,
      true,
    );

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "RouterHotspotIpBinding",
      entityId: `${id}:${bindingId}`,
      newValues: { disabled: true },
      description: `IP binding ${bindingId} desactive sur le routeur ${id}.`,
    });

    return result;
  }

  async getHotspotUsers(
    id: string,
    query: ListHotspotUsersQueryDto = {},
  ): Promise<RouterHotspotUser[]> {
    await this.findOne(id);
    return this.routerApiService.getHotspotUsers(id, query.search);
  }

  async updateHotspotUserProfile(
    id: string,
    dto: UpdateHotspotUserProfileDto,
    adminId: string,
  ): Promise<RouterHotspotUserProfileUpdateResult> {
    await this.findOne(id);
    const result = await this.routerApiService.updateHotspotUserProfile(id, {
      userId: dto.userId,
      profile: dto.profile,
      disconnectActive: dto.disconnectActive,
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "RouterHotspotUser",
      entityId: `${id}:${result.userId}`,
      newValues: {
        profile: result.profile,
        disconnectActive: Boolean(dto.disconnectActive),
        disconnectedSessions: result.disconnectedSessions,
      },
      description: `Profil hotspot de ${result.username} mis a jour sur le routeur ${id}.`,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // Active client enforcement
  // ---------------------------------------------------------------------------

  async disconnectActiveClientByUsername(
    routerId: string,
    username: string,
    adminId: string,
  ): Promise<{ disconnected: number }> {
    await this.findOne(routerId);
    const count =
      await this.routerApiService.disconnectActiveSessionsByUsername(
        routerId,
        username,
      );

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "RouterHotspotActiveSession",
      entityId: `${routerId}:${username}`,
      description: `Session active de ${username} deconnectee manuellement sur le routeur ${routerId}.`,
    });

    return { disconnected: count };
  }

  async disconnectExpiredActiveClients(
    routerId: string,
    adminId: string,
  ): Promise<{ disconnected: number; usernames: string[] }> {
    await this.findOne(routerId);

    const liveStats = await this.routerApiService.getLiveStats(routerId);
    const liveUsernames = liveStats.clients
      .map((c) => c.username)
      .filter(Boolean);

    if (liveUsernames.length === 0) {
      return { disconnected: 0, usernames: [] };
    }

    const now = new Date();
    const expiredVouchers = await this.prisma.voucher.findMany({
      where: {
        routerId,
        code: { in: liveUsernames },
        OR: [
          { status: VoucherStatus.EXPIRED },
          { status: VoucherStatus.REVOKED },
          { expiresAt: { lte: now } },
        ],
      },
      select: { code: true },
    });

    const expiredCodes = expiredVouchers.map((v) => v.code);
    let disconnected = 0;

    for (const code of expiredCodes) {
      try {
        const count =
          await this.routerApiService.disconnectActiveSessionsByUsername(
            routerId,
            code,
          );
        disconnected += count;
      } catch (e) {
        this.logger.warn(`Disconnect expired failed for ${code}: ${e}`);
      }
    }

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "RouterHotspotActiveSession",
      entityId: routerId,
      newValues: { disconnectedUsernames: expiredCodes, count: disconnected },
      description: `${disconnected} session(s) expiree(s) deconnectees sur le routeur ${routerId}.`,
    });

    return { disconnected, usernames: expiredCodes };
  }

  // ---------------------------------------------------------------------------
  // Router migration
  // ---------------------------------------------------------------------------

  async migrateActiveVouchers(
    sourceRouterId: string,
    targetRouterId: string,
    adminId: string,
    dryRun = false,
  ): Promise<{
    dryRun: boolean;
    sourceRouterId: string;
    targetRouterId: string;
    count: number;
    migrations: Array<{
      code: string;
      remainingMinutes: number;
      newVoucherId?: string;
    }>;
    failed?: string[];
  }> {
    await Promise.all([
      this.findOne(sourceRouterId),
      this.findOne(targetRouterId),
    ]);

    const now = new Date();

    const activeVouchers = await this.prisma.voucher.findMany({
      where: {
        routerId: sourceRouterId,
        status: VoucherStatus.ACTIVE,
        expiresAt: { gt: now },
      },
      include: {
        plan: {
          select: {
            id: true,
            slug: true,
            userProfile: true,
            dataLimitMb: true,
            durationMinutes: true,
          },
        },
      },
    });

    const migrationsPreview = activeVouchers.map((v) => ({
      code: v.code,
      remainingMinutes: Math.max(
        1,
        Math.ceil((v.expiresAt!.getTime() - now.getTime()) / 60000),
      ),
    }));

    if (dryRun) {
      return {
        dryRun: true,
        sourceRouterId,
        targetRouterId,
        count: migrationsPreview.length,
        migrations: migrationsPreview,
      };
    }

    const migrated: Array<{
      code: string;
      remainingMinutes: number;
      newVoucherId: string;
    }> = [];
    const failed: string[] = [];

    for (const v of activeVouchers) {
      const remainingMinutes = Math.max(
        1,
        Math.ceil((v.expiresAt!.getTime() - now.getTime()) / 60000),
      );
      const password = v.passwordPlain ?? randomBytes(4).toString("hex");

      try {
        const newVoucher = await this.prisma.voucher.create({
          data: {
            planId: v.planId,
            routerId: targetRouterId,
            createdById: adminId,
            generationType: GenerationType.MANUAL,
            code: v.code,
            passwordHash: v.passwordHash,
            passwordPlain: password,
            status: VoucherStatus.ACTIVE,
            activatedAt: now,
            expiresAt: new Date(now.getTime() + remainingMinutes * 60000),
            transactionId: v.transactionId,
            mikrotikComment: `MIGRE-${sourceRouterId.slice(0, 8)}`,
          },
        });

        await this.routerApiService.pushHotspotUser(
          targetRouterId,
          newVoucher.id,
          {
            username: v.code,
            password,
            profile: v.plan.userProfile,
            comment: `MIGRE-${now.toISOString().slice(0, 10)}`,
            limitUptime: this.minutesToRouterOsUptime(remainingMinutes),
            limitBytesIn: v.plan.dataLimitMb
              ? String(v.plan.dataLimitMb * 1024 * 1024)
              : undefined,
          },
        );

        await this.prisma.voucher.update({
          where: { id: v.id },
          data: { status: VoucherStatus.EXPIRED },
        });

        migrated.push({
          code: v.code,
          remainingMinutes,
          newVoucherId: newVoucher.id,
        });
      } catch (e) {
        this.logger.warn(`Migration failed for voucher ${v.code}: ${e}`);
        failed.push(v.code);
      }
    }

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: "RouterMigration",
      entityId: `${sourceRouterId}->${targetRouterId}`,
      newValues: { migrated: migrated.length, failed: failed.length },
      description: `Migration de ${migrated.length} ticket(s) actif(s) du routeur ${sourceRouterId} vers ${targetRouterId}.`,
    });

    return {
      dryRun: false,
      sourceRouterId,
      targetRouterId,
      count: migrated.length,
      migrations: migrated,
      failed,
    };
  }

  private minutesToRouterOsUptime(minutes: number): string {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0)
      parts.push(
        `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`,
      );
    else parts.push(`${String(mins).padStart(2, "0")}:00`);
    return parts.join("") || "01:00:00";
  }

  // ---------------------------------------------------------------------------
  // WireGuard auto-provisioning
  // ---------------------------------------------------------------------------

  /** Assign the next available IP in 10.66.66.x pool */
  private async assignNextWgIp(): Promise<string> {
    const used = await this.prisma.router.findMany({
      where: { deletedAt: null, wireguardIp: { not: null } },
      select: { wireguardIp: true },
    });
    const usedIps = new Set(used.map((r) => r.wireguardIp));
    for (let i = 2; i <= 254; i++) {
      const candidate = `${WG_SUBNET}.${i}`;
      if (!usedIps.has(candidate) && candidate !== WG_SERVER_IP) {
        return candidate;
      }
    }
    throw new Error("Subnet WireGuard plein (10.66.66.2–254 épuisé).");
  }

  /**
   * Fully automatic WireGuard provisioning:
   * 1. Generate keys + assign WG IP
   * 2. Push WG config directly to router via RouterOS API (using localIp from metadata)
   * 3. Poll until tunnel is established, then set wireguardIp in DB
   *
   * Falls back to key-only provisioning if API push fails (e.g. router not reachable yet).
   */
  private async provisionWireGuardViaApi(routerId: string): Promise<void> {
    const router = await this.prisma.router.findUnique({
      where: { id: routerId },
      select: {
        id: true, name: true, metadata: true,
        apiPort: true, apiUsername: true, apiPasswordHash: true,
      },
    });
    if (!router) return;

    const meta = (router.metadata ?? {}) as Record<string, unknown>;

    // Idempotent
    if (meta.wg && (meta.wg as Record<string, unknown>).wgIp) {
      this.logger.debug(`[WG] Router ${routerId} already provisioned`);
      return;
    }

    const localIp = meta.localIp as string | undefined;

    // Generate keys + assign WG IP
    const wgIp = await this.assignNextWgIp();
    const { privateKey, publicKey } = await generateWireGuardKeyPair();
    const vpsPublicKey = await getVpsPublicKey();

    const vpsEndpoint =
      this.configService.get<string>("WG_SERVER_ENDPOINT") ??
      `${this.configService.get<string>("HOST") ?? "139.84.241.27"}:${WG_LISTEN_PORT}`;
    const [vpsIp, vpsPortStr] = vpsEndpoint.split(":");
    const vpsPort = Number(vpsPortStr ?? WG_LISTEN_PORT);

    // Add peer on VPS
    await addWireGuardPeer(publicKey, wgIp);

    // Push WG config to router via RouterOS API if we have a direct IP
    if (localIp) {
      try {
        await executeRouterOperationResult({
          mikroNode: MikroNode,
          wireguardIp: localIp, // direct/public IP of router before WG tunnel
          apiPort: router.apiPort,
          username: router.apiUsername,
          password: router.apiPasswordHash,
          timeoutMs: 15000,
          operation: async (conn) => {
            // Create WireGuard interface
            await runCommand(conn, [
              "/interface/wireguard/add",
              "=name=wg-mks",
              `=listen-port=${WG_LISTEN_PORT}`,
              `=private-key=${privateKey}`,
            ]);
            // Add VPS as peer
            await runCommand(conn, [
              "/interface/wireguard/peers/add",
              "=interface=wg-mks",
              `=public-key=${vpsPublicKey}`,
              "=allowed-address=0.0.0.0/0",
              `=endpoint-address=${vpsIp}`,
              `=endpoint-port=${vpsPort}`,
              "=persistent-keepalive=25",
            ]);
            // Assign WG tunnel IP to the interface
            await runCommand(conn, [
              "/ip/address/add",
              `=address=${wgIp}/24`,
              "=interface=wg-mks",
            ]);
          },
        });
        this.logger.log(
          `[WG] Config pushed to "${router.name}" via RouterOS API at ${localIp}`,
        );
      } catch (err) {
        this.logger.warn(
          `[WG] RouterOS API push failed for "${router.name}" (${localIp}): ${String(err)}` +
          ` — keys generated, tunnel will connect when router is reachable`,
        );
      }
    } else {
      this.logger.warn(
        `[WG] No localIp for "${router.name}" — keys generated, manual WG setup needed`,
      );
    }

    // Save WG metadata regardless of API push success
    await this.prisma.router.update({
      where: { id: routerId },
      data: {
        metadata: {
          ...meta,
          wg: {
            wgIp,
            privateKey,
            publicKey,
            vpsPublicKey,
            endpoint: vpsEndpoint,
            listenPort: WG_LISTEN_PORT,
            provisionedAt: new Date().toISOString(),
          },
        },
      },
    });

    // Poll for tunnel establishment (up to 90s)
    for (let i = 0; i < 18; i++) {
      await new Promise<void>((r) => setTimeout(r, 5000));
      const connected = await isPeerConnected(publicKey);
      if (connected) {
        await this.prisma.router.update({
          where: { id: routerId },
          data: { wireguardIp: wgIp },
        });
        this.logger.log(
          `[WG] Tunnel established for "${router.name}" → ${wgIp}`,
        );
        void this.routerApiService.checkRouterHealth(routerId).catch(() => {});
        return;
      }
    }

    this.logger.warn(
      `[WG] Tunnel not established within 90s for "${router.name}" — will be detected by periodic scan`,
    );
  }

  /**
   * Provision WireGuard for a router: assign WG IP, generate keypair, add VPS peer.
   * Stores config in metadata.wg. Non-blocking — called fire-and-forget.
   */
  private async provisionWireGuard(routerId: string): Promise<void> {
    const router = await this.prisma.router.findUnique({
      where: { id: routerId },
      select: { id: true, name: true, metadata: true },
    });
    if (!router) return;

    const meta = (router.metadata ?? {}) as Record<string, unknown>;

    // Idempotent: skip if already provisioned
    if (meta.wg && (meta.wg as Record<string, unknown>).wgIp) {
      this.logger.debug(`[WG] Router ${routerId} already provisioned`);
      return;
    }

    const wgIp = await this.assignNextWgIp();
    const { privateKey, publicKey } = await generateWireGuardKeyPair();
    const vpsPublicKey = await getVpsPublicKey();

    await addWireGuardPeer(publicKey, wgIp);

    const vpsEndpoint =
      this.configService.get<string>("WG_SERVER_ENDPOINT") ??
      `${this.configService.get<string>("HOST") ?? "139.84.241.27"}:${WG_LISTEN_PORT}`;

    await this.prisma.router.update({
      where: { id: routerId },
      data: {
        metadata: {
          ...meta,
          wg: {
            wgIp,
            privateKey,
            publicKey,
            vpsPublicKey,
            endpoint: vpsEndpoint,
            listenPort: WG_LISTEN_PORT,
            provisionedAt: new Date().toISOString(),
          },
        },
      },
    });

    this.logger.log(`[WG] Provisioned ${router.name} → ${wgIp} (peer added)`);
  }

  /** Returns WireGuard bootstrap config for a router. Provisions on first call. */
  async getBootstrap(id: string, adminId: string): Promise<Record<string, unknown>> {
    const router = await this.prisma.router.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, metadata: true, wireguardIp: true },
    });
    if (!router) throw new NotFoundException("Routeur introuvable.");

    const meta = (router.metadata ?? {}) as Record<string, unknown>;
    const localIp = (meta.localIp as string | undefined) ?? null;

    // Provision if not done yet
    if (!meta.wg || !(meta.wg as Record<string, unknown>).wgIp) {
      await this.provisionWireGuard(id);
      // Re-read after provisioning
      const fresh = await this.prisma.router.findUnique({
        where: { id },
        select: { metadata: true, wireguardIp: true },
      });
      if (fresh) {
        Object.assign(meta, (fresh.metadata ?? {}) as Record<string, unknown>);
      }
    }

    const wg = (meta.wg ?? {}) as Record<string, unknown>;

    const tunnelReady = router.wireguardIp?.startsWith(`${WG_SUBNET}.`) ?? false;

    // Generate the MikroTik RouterOS CLI command
    const mikrotikCmd = localIp
      ? [
          `/interface wireguard add name=wg-mks listen-port=${String(wg.listenPort ?? WG_LISTEN_PORT)} private-key="${String(wg.privateKey ?? "")}"`,
          `/interface wireguard peers add interface=wg-mks public-key="${String(wg.vpsPublicKey ?? "")}" allowed-address=0.0.0.0/0 endpoint-address=${String((wg.endpoint as string | undefined)?.split(":")[0] ?? "")} endpoint-port=${String(wg.listenPort ?? WG_LISTEN_PORT)} persistent-keepalive=25`,
          `/ip address add address=${String(wg.wgIp ?? "")}/24 interface=wg-mks`,
        ].join(" ; ")
      : null;

    return {
      routerId: id,
      routerName: router.name,
      localIp,
      wgIp: wg.wgIp ?? null,
      privateKey: wg.privateKey ?? null,
      publicKey: wg.publicKey ?? null,
      vpsPublicKey: wg.vpsPublicKey ?? null,
      endpoint: wg.endpoint ?? null,
      listenPort: wg.listenPort ?? WG_LISTEN_PORT,
      tunnelReady,
      mikrotikCmd,
      provisionedAt: wg.provisionedAt ?? null,
    };
  }

  /**
   * Background scan every 30 seconds: detect routers whose WireGuard tunnel
   * has established and update wireguardIp so the RouterOS API can reach them.
   */
  @Cron("*/30 * * * * *")
  async scanPendingWgTunnels(): Promise<void> {
    const pending = await this.prisma.router.findMany({
      where: {
        deletedAt: null,
        wireguardIp: null, // not yet tunneled
      },
      select: { id: true, name: true, metadata: true },
    });

    for (const router of pending) {
      const meta = (router.metadata ?? {}) as Record<string, unknown>;
      const wg = meta.wg as Record<string, unknown> | undefined;
      if (!wg?.publicKey || !wg.wgIp) continue;

      const connected = await isPeerConnected(String(wg.publicKey));
      if (!connected) continue;

      const wgIp = String(wg.wgIp);
      await this.prisma.router.update({
        where: { id: router.id },
        data: { wireguardIp: wgIp },
      });

      this.logger.log(
        `[WG] Tunnel established for "${router.name}" → wireguardIp set to ${wgIp}`,
      );

      // Trigger health check now that tunnel is up
      void this.routerApiService.checkRouterHealth(router.id).catch(() => {});
    }
  }

  private sanitizeRouter(router: Router): RouterSafeView {
    const { apiPasswordHash: _apiPasswordHash, ...safeRouter } = router;
    return safeRouter;
  }

  private normalizeTags(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .slice(0, 12),
      ),
    );
  }

  /** Multi-field text search applied in-memory after DB fetch (status/site/tag filtered at DB level). */
  private matchesSearchFilter(
    router: RouterSafeView,
    search: string | undefined,
  ): boolean {
    if (!search?.trim()) return true;
    const needle = search.trim().toLowerCase();
    const haystack = [
      router.name,
      router.description ?? "",
      router.location ?? "",
      router.site ?? "",
      router.wireguardIp ?? "",
      ...router.tags,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  }
}
