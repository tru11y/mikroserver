import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { KeygenService } from "./keygen.service";
import { CidrAllocatorService } from "./cidr-allocator.service";
import { Inject } from "@nestjs/common";
import { IWireguardCliService } from "./wireguard-cli.service";
import { AllocateTunnelResponseDto } from "./dto/allocate-tunnel.dto";
import { ConfigService } from "@nestjs/config";
import { TunnelStatus } from "@prisma/client";

@Injectable()
export class TunnelsService {
  private readonly logger = new Logger(TunnelsService.name);
  private readonly serverPublicKey: string | null = null;
  private readonly serverEndpoint: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly keygen: KeygenService,
    private readonly cidrAllocator: CidrAllocatorService,
    @Inject("IWireguardCliService")
    private readonly wgCli: IWireguardCliService,
    private readonly config: ConfigService,
  ) {
    this.serverEndpoint =
      this.config.get<string>("WG_PUBLIC_ENDPOINT") ??
      `${this.config.get<string>("VPS_PUBLIC_IP", "127.0.0.1")}:51820`;
  }

  /**
   * Allocate a new WireGuard tunnel for the requesting user.
   * Generates keypair, assigns IP, adds VPS peer, persists Tunnel row.
   * Returns the client private key ONCE — it is never stored.
   */
  async allocate(ownerId: string): Promise<AllocateTunnelResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Find next free IP
      const ip = await this.cidrAllocator.allocateNextIp(ownerId, tx);

      // 2. Generate keypair
      const { privateKey, publicKey } = this.keygen.generateKeypair();

      // 3. Get server public key
      const serverPubKey = await this.wgCli.getServerPublicKey();

      // 4. Insert Tunnel row
      const tunnel = await tx.tunnel.create({
        data: {
          ownerId,
          tunnelIp: ip,
          clientPublicKey: publicKey,
          serverPublicKey: serverPubKey,
          status: TunnelStatus.PENDING,
        },
      });

      // 5. Add peer to WG interface via CLI
      await this.wgCli.addPeer(publicKey, `${ip}/32`);

      // 6. Return config — clientPrivateKey returned once, never stored
      return {
        tunnelId: tunnel.id,
        tunnelIp: ip,
        clientPrivateKey: privateKey,
        serverPublicKey: serverPubKey,
        serverEndpoint: this.serverEndpoint,
      };
    });
  }

  /**
   * Soft-delete a tunnel and remove the WG peer from the VPS.
   */
  async remove(tunnelId: string, ownerId: string): Promise<void> {
    const tunnel = await this.prisma.tunnel.findUnique({
      where: { id: tunnelId },
      include: { router: true },
    });

    if (!tunnel || tunnel.deletedAt) {
      throw new NotFoundException("Tunnel introuvable");
    }
    if (tunnel.ownerId !== ownerId) {
      throw new ForbiddenException("Ce tunnel ne vous appartient pas");
    }

    // Remove WG peer from VPS interface
    try {
      await this.wgCli.removePeer(tunnel.clientPublicKey);
    } catch (err) {
      this.logger.warn(
        `Failed to remove WG peer ${tunnel.clientPublicKey.slice(0, 8)}…: ${String(err)}`,
      );
    }

    await this.prisma.tunnel.update({
      where: { id: tunnelId },
      data: { deletedAt: new Date(), status: TunnelStatus.INACTIVE },
    });
  }

  /**
   * Cron: every 30 seconds, poll WG handshakes and update tunnel statuses.
   * PENDING → ACTIVE on first handshake.
   * ACTIVE → INACTIVE if no handshake in 5 minutes.
   */
  @Cron("*/30 * * * * *")
  async syncHandshakes(): Promise<void> {
    try {
      const peers = await this.wgCli.listPeers();
      if (peers.length === 0) return;

      const peerMap = new Map(peers.map((p) => [p.publicKey, p.lastHandshake]));

      const tunnels = await this.prisma.tunnel.findMany({
        where: {
          deletedAt: null,
          status: { in: [TunnelStatus.PENDING, TunnelStatus.ACTIVE] },
        },
        select: {
          id: true,
          clientPublicKey: true,
          status: true,
          lastHandshakeAt: true,
        },
      });

      const now = Date.now();
      const fiveMinMs = 5 * 60 * 1000;

      for (const tunnel of tunnels) {
        const handshake = peerMap.get(tunnel.clientPublicKey);
        if (!handshake) continue;

        const handshakeAge = now - handshake.getTime();

        if (
          tunnel.status === TunnelStatus.PENDING &&
          handshakeAge < fiveMinMs
        ) {
          await this.prisma.tunnel.update({
            where: { id: tunnel.id },
            data: {
              status: TunnelStatus.ACTIVE,
              lastHandshakeAt: handshake,
            },
          });
          this.logger.log(
            `Tunnel ${tunnel.id} PENDING → ACTIVE (handshake ${Math.round(handshakeAge / 1000)}s ago)`,
          );
        } else if (tunnel.status === TunnelStatus.ACTIVE) {
          if (handshakeAge >= fiveMinMs) {
            await this.prisma.tunnel.update({
              where: { id: tunnel.id },
              data: {
                status: TunnelStatus.INACTIVE,
                lastHandshakeAt: handshake,
              },
            });
            this.logger.warn(`Tunnel ${tunnel.id} ACTIVE → INACTIVE`);
          } else if (
            !tunnel.lastHandshakeAt ||
            handshake.getTime() > tunnel.lastHandshakeAt.getTime()
          ) {
            await this.prisma.tunnel.update({
              where: { id: tunnel.id },
              data: { lastHandshakeAt: handshake },
            });
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Handshake sync failed: ${String(err)}`);
    }
  }
}
