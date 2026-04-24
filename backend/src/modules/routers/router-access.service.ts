import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ForbiddenException,
  OnModuleInit,
} from "@nestjs/common";
import * as net from "net";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateAccessDto } from "./dto/router-access.dto";
import { UserRole } from "@prisma/client";
import {
  decryptRouterAccessPasswordCompat,
  deriveRouterAccessKey,
  encryptRouterAccessPassword,
  isRouterAccessPasswordEncrypted,
} from "./router-access.crypto";

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class RouterAccessService implements OnModuleInit {
  private readonly logger = new Logger(RouterAccessService.name);
  private readonly encKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const raw = this.configService.get<string>("ENCRYPTION_KEY");
    if (!raw) throw new Error("ENCRYPTION_KEY env var is not set");
    this.encKey = deriveRouterAccessKey(raw);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.reEncryptLegacyPlaintextPasswords();
    } catch (error) {
      this.logger.error(
        `Failed to migrate legacy router access passwords: ${(error as Error).message}`,
      );
    }
  }

  private async reEncryptLegacyPlaintextPasswords(): Promise<void> {
    const routers = await this.prisma.router.findMany({
      where: {
        accessPassword: { not: null },
        deletedAt: null,
      },
      select: { id: true, accessPassword: true },
    });

    const legacy = routers.filter(
      (router) =>
        typeof router.accessPassword === "string" &&
        !isRouterAccessPasswordEncrypted(router.accessPassword),
    );

    if (legacy.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      legacy.map((router) =>
        this.prisma.router.update({
          where: { id: router.id },
          data: {
            accessPassword: encryptRouterAccessPassword(
              router.accessPassword!,
              this.encKey,
            ),
          },
        }),
      ),
    );

    this.logger.warn(
      `[Security] Migrated ${legacy.length} router access password(s) from plaintext to AES-256-GCM`,
    );
  }

  // ── ownership guard ──────────────────────────────────────────────────────

  private async requireOwnership(
    routerId: string,
    userId: string,
    role: UserRole,
  ) {
    const router = await this.prisma.router.findUnique({
      where: { id: routerId, deletedAt: null },
      select: {
        id: true,
        ownerId: true,
        wireguardIp: true,
        winboxPort: true,
        webfigPort: true,
        sshPort: true,
        accessUsername: true,
        accessPassword: true,
        name: true,
      },
    });
    if (!router) throw new NotFoundException("Routeur introuvable");
    if (role !== UserRole.SUPER_ADMIN && router.ownerId !== userId) {
      throw new ForbiddenException(
        "Accès refusé : vous n'êtes pas propriétaire de ce routeur",
      );
    }
    return router;
  }

  // ── getAccessCredentials ─────────────────────────────────────────────────

  async getAccessCredentials(routerId: string, userId: string, role: UserRole) {
    const r = await this.requireOwnership(routerId, userId, role);

    let passwordDecrypted: string | null = null;
    if (r.accessPassword) {
      try {
        const decrypted = decryptRouterAccessPasswordCompat(
          r.accessPassword,
          this.encKey,
        );
        passwordDecrypted = decrypted.password;

        if (decrypted.wasLegacyPlaintext) {
          await this.prisma.router.update({
            where: { id: r.id },
            data: {
              accessPassword: encryptRouterAccessPassword(
                decrypted.password,
                this.encKey,
              ),
            },
          });

          this.logger.warn(
            `[Security] Re-encrypted legacy plaintext access password for router ${r.id}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Unable to decrypt access password for router ${r.id}: ${(error as Error).message}`,
        );
        throw new InternalServerErrorException(
          "Mot de passe d'accès routeur invalide",
        );
      }
    }

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
    if (dto.accessUsername !== undefined) {
      data.accessUsername = dto.accessUsername;
    }
    if (dto.accessPassword !== undefined) {
      data.accessPassword = encryptRouterAccessPassword(
        dto.accessPassword,
        this.encKey,
      );
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
    if (!router.wireguardIp) {
      throw new NotFoundException("IP VPN non configurée");
    }
    return { wireguardIp: router.wireguardIp, webfigPort: router.webfigPort };
  }
}
