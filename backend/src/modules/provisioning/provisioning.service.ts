import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import * as net from "net";
import * as QRCode from "qrcode";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ProvisioningStatus, NotificationType } from "@prisma/client";
import {
  generateWireGuardKeyPair,
  addWireGuardPeer,
  getVpsPublicKey,
  isPeerConnected,
} from "./wireguard.utils";

import type {
  MikroTikConnection,
  MikroTikModule,
} from "../routers/router-api.types";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const MikroNode = require("mikrotik") as MikroTikModule;

const WG_SUBNET = "10.66.66";
const WG_SERVER_IP = "10.66.66.1";
const WG_LISTEN_PORT = 51820;
const WG_INTERFACE_NAME = "wireguard-mikroserver";
const SCAN_API_PORT = 8728;
const SCAN_TIMEOUT_MS = 1000;
const SCAN_BATCH_SIZE = 20;

export interface StartProvisioningDto {
  routerName: string;
  location?: string;
  apiUsername: string;
  apiPassword: string;
  publicIp?: string;
  apiPort?: number;
}

type StepLogEntry = {
  step: string;
  status: "pending" | "running" | "ok" | "error";
  message: string;
  timestamp: string;
};

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async start(userId: string, dto: StartProvisioningDto) {
    const existing = await this.prisma.router.findUnique({
      where: { name: dto.routerName },
    });
    if (existing) {
      throw new BadRequestException(
        `Un routeur nommé "${dto.routerName}" existe déjà.`,
      );
    }

    // If a WireGuard IP is provided → direct connection (router already on tunnel)
    const isDirectWg = dto.publicIp?.startsWith(`${WG_SUBNET}.`);

    if (isDirectWg) {
      const session = await this.prisma.provisioningSession.create({
        data: {
          userId,
          routerName: dto.routerName,
          location: dto.location,
          apiUsername: dto.apiUsername,
          apiPassword: dto.apiPassword,
          publicIp: dto.publicIp,
          apiPort: dto.apiPort ?? 8728,
          assignedWgIp: dto.publicIp,
          status: ProvisioningStatus.CONNECTING,
          stepLog: [],
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      this.runDirectProvisioning(session.id).catch((err) =>
        this.logger.error(
          `Direct provisioning error for ${session.id}: ${String(err)}`,
        ),
      );

      return session;
    }

    // Otherwise → phone-home bootstrap (new router, WireGuard not yet configured)
    const assignedWgIp = await this.assignNextWireGuardIp();
    const { privateKey, publicKey } = await generateWireGuardKeyPair();
    const bootstrapToken = randomBytes(32).toString("hex");

    const session = await this.prisma.provisioningSession.create({
      data: {
        userId,
        routerName: dto.routerName,
        location: dto.location,
        apiUsername: dto.apiUsername,
        apiPassword: dto.apiPassword,
        publicIp: dto.publicIp,
        apiPort: dto.apiPort ?? 8728,
        bootstrapToken,
        wgPrivateKey: privateKey,
        wgPublicKey: publicKey,
        assignedWgIp,
        status: ProvisioningStatus.PENDING_BOOTSTRAP,
        stepLog: [],
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    return session;
  }

  /**
   * Step 1 of browser-based provisioning.
   * Generates WireGuard config for the router.
   * The browser will use this to configure the router directly via REST API.
   */
  async prepare(
    userId: string,
    routerName: string,
    location?: string,
    apiUsername?: string,
    apiPassword?: string,
    publicIp?: string,
    apiPort?: number,
  ) {
    const existing = await this.prisma.router.findUnique({
      where: { name: routerName },
    });
    if (existing) {
      throw new BadRequestException(
        `Un routeur nommé "${routerName}" existe déjà.`,
      );
    }

    const assignedWgIp = await this.assignNextWireGuardIp();
    const { privateKey, publicKey } = await generateWireGuardKeyPair();
    const vpsPublicKey = await this.getVpsPublicKeySafe();
    const vpsIp = this.configService.get<string>("VPS_PUBLIC_IP", "");

    const session = await this.prisma.provisioningSession.create({
      data: {
        userId,
        routerName,
        location,
        apiUsername: apiUsername ?? "admin",
        apiPassword,
        publicIp,
        apiPort: apiPort ?? 8728,
        wgPrivateKey: privateKey,
        wgPublicKey: publicKey,
        assignedWgIp,
        status: ProvisioningStatus.PENDING_BOOTSTRAP,
        stepLog: [],
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    return {
      sessionId: session.id,
      routerPrivateKey: privateKey,
      routerPublicKey: publicKey,
      routerWgIp: assignedWgIp,
      vpsPublicKey,
      vpsEndpoint: `${vpsIp}:${WG_LISTEN_PORT}`,
      wgInterfaceName: WG_INTERFACE_NAME,
      wgServerIp: WG_SERVER_IP,
    };
  }

  /**
   * Step 2 of browser-based provisioning.
   * Called after the browser has configured WireGuard on the router via REST API.
   * VPS adds the peer and waits for tunnel, then creates Router in DB.
   */
  async finalize(
    sessionId: string,
    userId: string,
    routerIdentity: string,
    hotspotName: string,
  ) {
    const session = await this.prisma.provisioningSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException("Session introuvable.");
    if (session.status === ProvisioningStatus.COMPLETED) {
      throw new BadRequestException("Provisioning déjà complété.");
    }

    await this.prisma.provisioningSession.update({
      where: { id: sessionId },
      data: {
        routerIdentity,
        status: ProvisioningStatus.CONFIGURING_WIREGUARD,
      },
    });

    // Add WireGuard peer on VPS
    if (session.wgPublicKey) {
      await addWireGuardPeer(session.wgPublicKey, session.assignedWgIp!).catch(
        (err) => this.logger.warn(`WG peer add failed: ${String(err)}`),
      );
    }

    this.runPostFinalizeProvisioning(
      session.id,
      routerIdentity,
      hotspotName,
    ).catch((err) =>
      this.logger.error(
        `Post-finalize error for ${session.id}: ${String(err)}`,
      ),
    );

    return this.getStatus(sessionId, userId);
  }

  /**
   * Called by the MikroTik router via /tool fetch.
   * Public endpoint — no JWT.
   * Returns a RouterOS .rsc script that sets up WireGuard.
   */
  async handleBootstrap(token: string): Promise<string> {
    const session = await this.prisma.provisioningSession.findUnique({
      where: { bootstrapToken: token },
    });

    if (!session || session.status !== ProvisioningStatus.PENDING_BOOTSTRAP) {
      throw new NotFoundException("Token de provisioning invalide ou expiré.");
    }

    if (session.expiresAt < new Date()) {
      throw new NotFoundException("Token de provisioning expiré.");
    }

    const vpsPublicKey = await this.getVpsPublicKeySafe();
    const vpsIp = this.configService.get<string>("VPS_PUBLIC_IP", "");
    const assignedWgIp = session.assignedWgIp!;
    const routerPrivateKey = session.wgPrivateKey!;

    // Add router as WireGuard peer on VPS side
    if (session.wgPublicKey) {
      await addWireGuardPeer(session.wgPublicKey, assignedWgIp).catch((err) =>
        this.logger.warn(`WG peer add failed: ${String(err)}`),
      );
    }

    // Update session status
    await this.prisma.provisioningSession.update({
      where: { id: session.id },
      data: {
        status: ProvisioningStatus.CONFIGURING_WIREGUARD,
        bootstrapToken: null, // invalidate token after use
      },
    });

    // Start async post-bootstrap provisioning
    this.runPostBootstrapProvisioning(session.id).catch((err) =>
      this.logger.error(
        `Post-bootstrap error for ${session.id}: ${String(err)}`,
      ),
    );

    // Build the RSC script
    const rsc = this.buildRscScript(
      routerPrivateKey,
      vpsPublicKey,
      vpsIp,
      assignedWgIp,
    );

    return rsc;
  }

  async getStatus(sessionId: string, userId: string) {
    const session = await this.prisma.provisioningSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        router: { select: { id: true, name: true, status: true } },
      },
    });

    if (!session) {
      throw new NotFoundException("Session de provisioning introuvable.");
    }

    // Never expose stored password
    return { ...session, apiPassword: undefined };
  }

  async listSessions(userId: string) {
    return this.prisma.provisioningSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { router: { select: { id: true, name: true } } },
    });
  }

  private buildRscScript(
    routerPrivateKey: string,
    vpsPublicKey: string,
    vpsIp: string,
    routerWgIp: string,
  ): string {
    return `# MikroServer Auto-Provisioning Bootstrap
# Ce script configure le tunnel WireGuard vers MikroServer.
# NE PAS MODIFIER - genere automatiquement.

/interface wireguard
:do { add name="${WG_INTERFACE_NAME}" private-key="${routerPrivateKey}" listen-port=${WG_LISTEN_PORT} comment="MikroServer - ne pas modifier" } on-error={}

/interface wireguard peers
:do { add interface="${WG_INTERFACE_NAME}" public-key="${vpsPublicKey}" endpoint="${vpsIp}:${WG_LISTEN_PORT}" allowed-address="${WG_SERVER_IP}/32" persistent-keepalive=25 comment="MikroServer VPS" } on-error={}

/ip address
:do { add address="${routerWgIp}/24" interface="${WG_INTERFACE_NAME}" comment="MikroServer WireGuard IP" } on-error={}

/system scheduler
:do { remove [find name="ms-wg-watchdog"] } on-error={}
add name="ms-wg-watchdog" interval=5m start-time=startup comment="MikroServer WireGuard watchdog" \
  on-event=":local iface [/interface wireguard find name=\\"${WG_INTERFACE_NAME}\\"]\
\n:if (\$iface = \\"\\") do={ :log warning \\"ms-wg-watchdog: interface ${WG_INTERFACE_NAME} introuvable\\" } else={\
\n:if ([/interface wireguard get \$iface running] = false) do={\
\n/interface wireguard disable \$iface\
\n:delay 2s\
\n/interface wireguard enable \$iface\
\n:log info \\"ms-wg-watchdog: tunnel WireGuard relance\\"\
\n}}"
`;
  }

  /**
   * Direct provisioning: router already has WireGuard configured (10.66.66.x).
   * Connects immediately via WireGuard IP, no bootstrap needed.
   */
  /**
   * After browser has configured router via REST API + VPS peer added.
   * Polls for WireGuard tunnel, then creates Router in DB.
   */
  private async runPostFinalizeProvisioning(
    sessionId: string,
    routerIdentity: string,
    hotspotName: string,
  ) {
    const session = await this.prisma.provisioningSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    const log: StepLogEntry[] = [];

    const addLog = async (
      step: string,
      status: StepLogEntry["status"],
      message: string,
    ) => {
      log.push({ step, status, message, timestamp: new Date().toISOString() });
      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: { stepLog: log as object[], currentStep: step },
      });
    };

    try {
      await addLog("wireguard", "running", "En attente du tunnel WireGuard...");

      let tunnelUp = false;
      for (let i = 0; i < 24; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        tunnelUp = await isPeerConnected(session.wgPublicKey!).catch(
          () => false,
        );
        if (tunnelUp) break;
      }

      if (!tunnelUp) {
        throw new Error("Tunnel WireGuard non établi dans les 2 minutes.");
      }

      await addLog(
        "wireguard",
        "ok",
        `Tunnel WireGuard actif. IP: ${session.assignedWgIp}`,
      );
      await addLog("hotspot", "ok", `Hotspot: ${hotspotName}`);
      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: { status: ProvisioningStatus.VERIFYING },
      });

      const router = await this.prisma.router.create({
        data: {
          name: session.routerName ?? routerIdentity,
          description: "Provisionné via REST API (browser)",
          location: session.location,
          wireguardIp: session.assignedWgIp!,
          apiPort: session.apiPort,
          apiUsername: session.apiUsername,
          apiPasswordHash: session.apiPassword!,
          ownerId: session.userId,
          hotspotServer: hotspotName,
          metadata: {
            provisionedAt: new Date().toISOString(),
            provisioningSessionId: sessionId,
            routerIdentity,
            wgPublicKey: session.wgPublicKey,
          },
        },
      });

      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: {
          status: ProvisioningStatus.COMPLETED,
          routerId: router.id,
          currentStep: "completed",
          apiPassword: null,
        },
      });
      await addLog(
        "completed",
        "ok",
        `Routeur "${router.name}" ajouté avec succès!`,
      );

      await this.notificationsService.create(session.userId, {
        type: NotificationType.ROUTER_ONLINE,
        title: "Routeur ajouté avec succès",
        body: `Le routeur "${router.name}" est maintenant géré par la plateforme.`,
        data: { routerId: router.id, routerName: router.name },
        routerId: router.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await addLog("error", "error", `Erreur: ${message}`).catch(() => {});
      await this.prisma.provisioningSession
        .update({
          where: { id: sessionId },
          data: {
            status: ProvisioningStatus.FAILED,
            error: message.substring(0, 1000),
            apiPassword: null,
          },
        })
        .catch(() => {});
    }
  }

  private async runDirectProvisioning(sessionId: string) {
    const session = await this.prisma.provisioningSession.findUniqueOrThrow({
      where: { id: sessionId },
    });

    const log: StepLogEntry[] = [];
    const addLog = async (
      step: string,
      status: StepLogEntry["status"],
      message: string,
    ) => {
      log.push({ step, status, message, timestamp: new Date().toISOString() });
      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: { stepLog: log as object[], currentStep: step },
      });
    };

    try {
      await addLog(
        "connect",
        "running",
        `Connexion à ${session.assignedWgIp}:${session.apiPort} via WireGuard...`,
      );

      const conn = await this.connectToRouter(
        session.assignedWgIp!,
        session.apiPort,
        session.apiUsername,
        session.apiPassword!,
      );

      const identityResult = await this.runCommand(
        conn,
        "/system/identity/print",
      );
      const routerIdentity =
        (identityResult?.[0] as { name?: string })?.name ??
        session.routerName ??
        "router";

      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: { routerIdentity: routerIdentity ?? undefined },
      });
      await addLog("connect", "ok", `Connecté: ${routerIdentity}`);

      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: { status: ProvisioningStatus.CONFIGURING_HOTSPOT },
      });
      await addLog("hotspot", "running", "Vérification du hotspot...");

      const hotspots = await this.runCommand(conn, "/ip/hotspot/print");
      const hotspotName =
        Array.isArray(hotspots) && hotspots.length > 0
          ? ((hotspots[0] as Record<string, string>).name ?? "hotspot1")
          : "hotspot1";
      await addLog("hotspot", "ok", `Hotspot détecté: ${hotspotName}`);

      try {
        (conn as { close?: () => void }).close?.();
      } catch {
        /* ignore */
      }

      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: { status: ProvisioningStatus.VERIFYING },
      });

      const router = await this.prisma.router.create({
        data: {
          name: session.routerName ?? routerIdentity,
          description: `Provisionné via WireGuard (connexion directe)`,
          location: session.location,
          wireguardIp: session.assignedWgIp!,
          apiPort: session.apiPort,
          apiUsername: session.apiUsername,
          apiPasswordHash: session.apiPassword!,
          ownerId: session.userId,
          hotspotServer: hotspotName,
          metadata: {
            provisionedAt: new Date().toISOString(),
            provisioningSessionId: sessionId,
            routerIdentity,
          },
        },
      });

      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: {
          status: ProvisioningStatus.COMPLETED,
          routerId: router.id,
          currentStep: "completed",
          apiPassword: null,
        },
      });
      await addLog(
        "completed",
        "ok",
        `Routeur "${router.name}" ajouté avec succès!`,
      );

      await this.notificationsService.create(session.userId, {
        type: NotificationType.ROUTER_ONLINE,
        title: "Routeur ajouté avec succès",
        body: `Le routeur "${router.name}" est maintenant géré par la plateforme.`,
        data: { routerId: router.id, routerName: router.name },
        routerId: router.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Direct provisioning failed for ${sessionId}: ${message}`,
      );
      await addLog("error", "error", `Erreur: ${message}`).catch(() => {});
      await this.prisma.provisioningSession
        .update({
          where: { id: sessionId },
          data: {
            status: ProvisioningStatus.FAILED,
            error: message.substring(0, 1000),
            apiPassword: null,
          },
        })
        .catch(() => {});
      await this.notificationsService
        .create(session.userId, {
          type: NotificationType.SYSTEM,
          title: "Échec du provisioning",
          body: `Impossible de configurer le routeur: ${message}`,
        })
        .catch(() => {});
    }
  }

  private async runPostBootstrapProvisioning(sessionId: string) {
    const session = await this.prisma.provisioningSession.findUniqueOrThrow({
      where: { id: sessionId },
    });

    const log: StepLogEntry[] = [];

    const addLog = async (
      step: string,
      status: StepLogEntry["status"],
      message: string,
    ) => {
      log.push({ step, status, message, timestamp: new Date().toISOString() });
      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: { stepLog: log as object[], currentStep: step },
      });
    };

    try {
      // ----------------------------------------------------------------
      // Step 1: Wait for WireGuard tunnel to come up
      // ----------------------------------------------------------------
      await addLog(
        "wireguard",
        "running",
        "En attente de la connexion WireGuard du routeur...",
      );

      const wgPublicKey = session.wgPublicKey!;
      let tunnelUp = false;

      for (let attempt = 0; attempt < 24; attempt++) {
        await new Promise((r) => setTimeout(r, 5000));
        tunnelUp = await isPeerConnected(wgPublicKey).catch(() => false);
        if (tunnelUp) break;
        this.logger.debug(
          `WG tunnel check ${attempt + 1}/24 for session ${sessionId}`,
        );
      }

      if (!tunnelUp) {
        throw new Error(
          "Le routeur ne s'est pas connecté au tunnel WireGuard dans les 2 minutes. Vérifiez que le script a bien été importé.",
        );
      }

      await addLog(
        "wireguard",
        "ok",
        `Tunnel WireGuard actif. IP: ${session.assignedWgIp}`,
      );

      // ----------------------------------------------------------------
      // Step 2: Connect to router via WireGuard
      // ----------------------------------------------------------------
      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: { status: ProvisioningStatus.CONNECTING },
      });
      await addLog(
        "connect",
        "running",
        `Connexion à ${session.assignedWgIp}:8728 via WireGuard...`,
      );

      const conn = await this.connectToRouter(
        session.assignedWgIp!,
        8728,
        session.apiUsername,
        session.apiPassword!,
      );

      const identityResult = await this.runCommand(
        conn,
        "/system/identity/print",
      );
      const routerIdentity =
        (identityResult?.[0] as { name?: string })?.name ??
        session.routerName ??
        "router";

      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: { routerIdentity: routerIdentity ?? undefined },
      });

      await addLog("connect", "ok", `Connecté au routeur: ${routerIdentity}`);

      // ----------------------------------------------------------------
      // Step 3: Verify hotspot (non-destructive)
      // ----------------------------------------------------------------
      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: { status: ProvisioningStatus.CONFIGURING_HOTSPOT },
      });
      await addLog(
        "hotspot",
        "running",
        "Vérification de la configuration hotspot...",
      );

      const hotspots = await this.runCommand(conn, "/ip/hotspot/print");
      const hotspotName =
        Array.isArray(hotspots) && hotspots.length > 0
          ? ((hotspots[0] as Record<string, string>).name ?? "hotspot1")
          : "hotspot1";

      await addLog("hotspot", "ok", `Hotspot détecté: ${hotspotName}`);

      try {
        (conn as { close?: () => void }).close?.();
      } catch {
        /* ignore */
      }

      // ----------------------------------------------------------------
      // Step 4: Create Router in DB
      // ----------------------------------------------------------------
      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: { status: ProvisioningStatus.VERIFYING },
      });
      await addLog("verify", "running", "Enregistrement du routeur...");

      const router = await this.prisma.router.create({
        data: {
          name: session.routerName ?? routerIdentity,
          description: `Provisionné automatiquement via WireGuard`,
          location: session.location,
          wireguardIp: session.assignedWgIp!,
          apiPort: 8728,
          apiUsername: session.apiUsername,
          apiPasswordHash: session.apiPassword!,
          ownerId: session.userId,
          hotspotServer: hotspotName,
          metadata: {
            provisionedAt: new Date().toISOString(),
            provisioningSessionId: sessionId,
            routerIdentity,
            wgPublicKey,
          },
        },
      });

      // Clear password from session after use
      await this.prisma.provisioningSession.update({
        where: { id: sessionId },
        data: {
          status: ProvisioningStatus.COMPLETED,
          routerId: router.id,
          currentStep: "completed",
          apiPassword: null,
        },
      });

      await addLog(
        "completed",
        "ok",
        `Routeur "${router.name}" ajouté avec succès! ID: ${router.id}`,
      );

      await this.notificationsService.create(session.userId, {
        type: NotificationType.ROUTER_ONLINE,
        title: "Routeur ajouté avec succès",
        body: `Le routeur "${router.name}" est maintenant géré par la plateforme.`,
        data: { routerId: router.id, routerName: router.name },
        routerId: router.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Post-bootstrap failed for session ${sessionId}: ${message}`,
      );

      await addLog("error", "error", `Erreur: ${message}`).catch(() => {});
      await this.prisma.provisioningSession
        .update({
          where: { id: sessionId },
          data: {
            status: ProvisioningStatus.FAILED,
            error: message.substring(0, 1000),
            apiPassword: null,
          },
        })
        .catch(() => {});

      await this.notificationsService
        .create(session.userId, {
          type: NotificationType.SYSTEM,
          title: "Échec du provisioning",
          body: `Impossible de configurer le routeur: ${message}`,
        })
        .catch(() => {});
    }
  }

  private async connectToRouter(
    ip: string,
    port: number,
    username: string,
    password: string,
  ): Promise<MikroTikConnection> {
    const connection = MikroNode.getConnection(ip, username, password, {
      port,
      timeout: 10,
      closeOnDone: false,
      closeOnTimeout: true,
    });
    return connection.getConnectPromise();
  }

  private async runCommand(
    conn: MikroTikConnection,
    path: string,
    params?: Record<string, string>,
  ): Promise<unknown[]> {
    const channel = conn.openChannel();
    const commands = [path];
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        commands.push(`=${k}=${v}`);
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Timeout commande: ${path}`)),
        8000,
      );

      channel.write(commands);
      channel.on("trap", (err: unknown) => {
        clearTimeout(timeout);
        const msg =
          typeof err === "object" && err !== null
            ? JSON.stringify(err)
            : String(err);
        reject(new Error(`RouterOS trap: ${msg}`));
      });
      channel.once("done", (data: unknown) => {
        clearTimeout(timeout);
        const parsed = MikroNode.parseItems(data);
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      });
    });
  }

  private async getVpsPublicKeySafe(): Promise<string> {
    try {
      return await getVpsPublicKey();
    } catch {
      return this.configService.get<string>("VPS_WG_PUBLIC_KEY", "");
    }
  }

  private async assignNextWireGuardIp(): Promise<string> {
    const used = await this.prisma.router.findMany({
      where: { deletedAt: null },
      select: { wireguardIp: true },
    });

    const usedIps = new Set(used.map((r) => r.wireguardIp));

    for (let i = 2; i <= 254; i++) {
      const candidate = `${WG_SUBNET}.${i}`;
      if (!usedIps.has(candidate) && candidate !== WG_SERVER_IP) {
        return candidate;
      }
    }

    throw new Error("Aucune adresse WireGuard disponible (subnet plein).");
  }

  async getBootstrapQr(sessionId: string, userId: string): Promise<string> {
    const session = await this.prisma.provisioningSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException("Session introuvable.");
    if (!session.bootstrapToken) {
      throw new BadRequestException(
        "Aucun token bootstrap disponible pour cette session.",
      );
    }

    const vpsIp = this.configService.get<string>("VPS_PUBLIC_IP", "139.84.241.27");
    const command = `/tool fetch url="http://${vpsIp}:3000/api/v1/provisioning/bootstrap/${session.bootstrapToken}" output=file dst-path=bs.rsc; /import bs.rsc`;

    const dataUrl = await QRCode.toDataURL(command, {
      errorCorrectionLevel: "M",
      width: 300,
      margin: 2,
    });
    return dataUrl;
  }

  async scanNetwork(): Promise<{ ip: string; reachable: boolean }[]> {
    const candidates: string[] = [];
    for (let i = 2; i <= 254; i++) {
      candidates.push(`${WG_SUBNET}.${i}`);
    }

    const results: { ip: string; reachable: boolean }[] = [];

    for (
      let offset = 0;
      offset < candidates.length;
      offset += SCAN_BATCH_SIZE
    ) {
      const batch = candidates.slice(offset, offset + SCAN_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((ip) => this.probePort(ip, SCAN_API_PORT, SCAN_TIMEOUT_MS)),
      );
      for (let j = 0; j < batch.length; j++) {
        if (batchResults[j]) {
          results.push({ ip: batch[j], reachable: true });
        }
      }
    }

    return results;
  }

  private probePort(
    ip: string,
    port: number,
    timeoutMs: number,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: ip, port });

      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeoutMs);

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
}
