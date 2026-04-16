import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import * as net from "net";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateAccessDto } from "./dto/router-access.dto";
import { UserRole } from "@prisma/client";

const ALGO = "aes-256-gcm";

// ─── Encryption helpers ─────────────────────────────────────────────────────

function deriveKey(rawKey: string): Buffer {
  // scrypt: deterministic, 32-byte key derived from env var
  return scryptSync(rawKey, "mikroserver-router-access-salt", 32);
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ct].map((b) => b.toString("base64")).join(":");
}

function decrypt(stored: string, key: Buffer): string {
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted format");
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8",
  );
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class RouterAccessService {
  private readonly logger = new Logger(RouterAccessService.name);
  private readonly encKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const raw = this.configService.get<string>("ENCRYPTION_KEY");
    if (!raw) throw new Error("ENCRYPTION_KEY env var is not set");
    this.encKey = deriveKey(raw);
  }

  // ── ownership guard ──────────────────────────────────────────────────────

  private async requireOwnership(
    routerId: string,
    userId: string,
    role: UserRole,
  ) {
    const router = await this.prisma.router.findUnique({
      where: { id: routerId, deletedAt: null },
      select: { id: true, ownerId: true, wireguardIp: true, winboxPort: true, webfigPort: true, sshPort: true, accessUsername: true, accessPassword: true, name: true },
    });
    if (!router) throw new NotFoundException("Routeur introuvable");
    if (
      role !== UserRole.SUPER_ADMIN &&
      router.ownerId !== userId
    ) {
      throw new ForbiddenException("Accès refusé : vous n'êtes pas propriétaire de ce routeur");
    }
    return router;
  }

  // ── getAccessCredentials ─────────────────────────────────────────────────

  async getAccessCredentials(routerId: string, userId: string, role: UserRole) {
    const r = await this.requireOwnership(routerId, userId, role);
    const passwordDecrypted = r.accessPassword
      ? decrypt(r.accessPassword, this.encKey)
      : null;

    const vpnIp = r.wireguardIp ?? "—";

    return {
      routerId: r.id,
      routerName: r.name,
      vpnIp,
      winbox: {
        address: `${vpnIp}:${r.winboxPort}`,
        port: r.winboxPort,
        username: r.accessUsername,
        password: passwordDecrypted,
        deepLink: `mikrotik://connect?address=${vpnIp}&port=${r.winboxPort}`,
      },
      webfig: {
        url: `http://${vpnIp}:${r.webfigPort}`,
        port: r.webfigPort,
        username: r.accessUsername,
        password: passwordDecrypted,
      },
      ssh: {
        command: `ssh ${r.accessUsername}@${vpnIp} -p ${r.sshPort}`,
        host: vpnIp,
        port: r.sshPort,
        username: r.accessUsername,
        password: passwordDecrypted,
      },
    };
  }

  // ── updateAccessCredentials ──────────────────────────────────────────────

  async updateAccessCredentials(
    routerId: string,
    dto: UpdateAccessDto,
    userId: string,
    role: UserRole,
  ) {
    await this.requireOwnership(routerId, userId, role);

    const data: Record<string, unknown> = {};
    if (dto.winboxPort !== undefined) data.winboxPort = dto.winboxPort;
    if (dto.webfigPort !== undefined) data.webfigPort = dto.webfigPort;
    if (dto.sshPort !== undefined) data.sshPort = dto.sshPort;
    if (dto.accessUsername !== undefined) data.accessUsername = dto.accessUsername;
    if (dto.accessPassword !== undefined) {
      data.accessPassword = encrypt(dto.accessPassword, this.encKey);
    }

    await this.prisma.router.update({
      where: { id: routerId },
      data,
    });

    return { success: true };
  }

  // ── testConnection ───────────────────────────────────────────────────────

  async testConnection(
    routerId: string,
    userId: string,
    role: UserRole,
  ): Promise<{ reachable: boolean; latencyMs: number }> {
    const r = await this.requireOwnership(routerId, userId, role);
    const host = r.wireguardIp;
    const port = r.sshPort;

    if (!host) return { reachable: false, latencyMs: 0 };

    const start = Date.now();
    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port, family: 4 });
      const TIMEOUT_MS = 3000;

      const timer = setTimeout(() => {
        socket.destroy();
        resolve({ reachable: false, latencyMs: TIMEOUT_MS });
      }, TIMEOUT_MS);

      socket.once("connect", () => {
        clearTimeout(timer);
        socket.destroy();
        resolve({ reachable: true, latencyMs: Date.now() - start });
      });

      socket.once("error", () => {
        clearTimeout(timer);
        resolve({ reachable: false, latencyMs: Date.now() - start });
      });
    });
  }

  // ── getRouterForProxy ────────────────────────────────────────────────────

  async getRouterForProxy(routerId: string) {
    const router = await this.prisma.router.findUnique({
      where: { id: routerId, deletedAt: null },
      select: { wireguardIp: true, webfigPort: true },
    });
    if (!router) throw new NotFoundException("Routeur introuvable");
    if (!router.wireguardIp) throw new NotFoundException("IP VPN non configurée");
    return { wireguardIp: router.wireguardIp, webfigPort: router.webfigPort };
  }
}
