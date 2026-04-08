import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RouterApiService } from './router-api.service';
import { AuditService } from '../audit/audit.service';
import { CreateRouterDto, UpdateRouterDto } from './dto/router.dto';
import { Router, AuditAction, RouterStatus } from '@prisma/client';
import { RouterLiveStats } from './router-api.service';

@Injectable()
export class RoutersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routerApiService: RouterApiService,
    private readonly auditService: AuditService,
  ) { }

  async findAll(): Promise<Router[]> {
    return this.prisma.router.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<Router> {
    const router = await this.prisma.router.findUnique({
      where: { id, deletedAt: null },
    });
    if (!router) throw new NotFoundException(`Router ${id} not found`);
    return router;
  }

  async create(dto: CreateRouterDto, adminId: string): Promise<Router> {
    // Check for existing router with same wireguardIp (including deleted ones)
    const existing = await this.prisma.router.findFirst({
      where: {
        OR: [
          { wireguardIp: dto.wireguardIp },
          { name: dto.name },
        ],
      },
    });

    if (existing) {
      if (existing.deletedAt === null) {
        const conflictField = existing.wireguardIp === dto.wireguardIp ? 'IP' : 'Nom';
        throw new ConflictException(`Un serveur avec ce ${conflictField} existe déjà.`);
      }

      // Re-activate and update soft-deleted router
      const restored = await this.prisma.router.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          description: dto.description,
          location: dto.location,
          wireguardIp: dto.wireguardIp,
          apiPort: dto.apiPort ?? 8728,
          apiUsername: dto.apiUsername,
          apiPasswordHash: dto.apiPassword,
          hotspotProfile: dto.hotspotProfile ?? 'default',
          hotspotServer: dto.hotspotServer ?? 'hotspot1',
          deletedAt: null,
          status: RouterStatus.OFFLINE,
        },
      });

      await this.auditService.log({
        userId: adminId,
        action: AuditAction.UPDATE,
        entityType: 'Router',
        entityId: restored.id,
        description: `Router "${restored.name}" restored and updated`,
      });

      return restored;
    }

    const router = await this.prisma.router.create({
      data: {
        name: dto.name,
        description: dto.description,
        location: dto.location,
        wireguardIp: dto.wireguardIp,
        apiPort: dto.apiPort ?? 8728,
        apiUsername: dto.apiUsername,
        apiPasswordHash: dto.apiPassword,
        hotspotProfile: dto.hotspotProfile ?? 'default',
        hotspotServer: dto.hotspotServer ?? 'hotspot1',
      },
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.CREATE,
      entityType: 'Router',
      entityId: router.id,
      description: `Router "${router.name}" added at ${router.wireguardIp}`,
    });

    return router;
  }

  async update(id: string, dto: UpdateRouterDto, adminId: string): Promise<Router> {
    const existing = await this.findOne(id);

    const { apiPassword, ...rest } = dto as UpdateRouterDto & { apiPassword?: string };
    const updateData: Record<string, unknown> = { ...rest };
    if (apiPassword) updateData['apiPasswordHash'] = apiPassword;

    const updated = await this.prisma.router.update({
      where: { id },
      data: updateData,
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: 'Router',
      entityId: id,
      oldValues: existing as unknown as Record<string, unknown>,
      newValues: dto,
    });

    return updated;
  }

  async remove(id: string, adminId: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.router.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.auditService.log({
      userId: adminId,
      action: AuditAction.DELETE,
      entityType: 'Router',
      entityId: id,
      description: `Router ${id} deleted`,
    });
  }

  async healthCheck(id: string): Promise<{ online: boolean; latencyMs?: number }> {
    const start = Date.now();
    const online = await this.routerApiService.checkRouterHealth(id);
    const latencyMs = Date.now() - start;
    return { online, latencyMs };
  }

  async getLiveStats(id: string): Promise<RouterLiveStats> {
    return this.routerApiService.getLiveStats(id);
  }

  async getWireguardConfig(id: string): Promise<{ config: string; routerName: string; wireguardIp: string }> {
    const router = await this.findOne(id);

    // Fetch VPS WireGuard settings from SystemConfig if available
    const vpsPublicKeyConfig = await this.prisma.systemConfig.findUnique({ where: { key: 'wireguard.vps_public_key' } });
    const vpsEndpointConfig = await this.prisma.systemConfig.findUnique({ where: { key: 'wireguard.vps_endpoint' } });
    const vpsListenPortConfig = await this.prisma.systemConfig.findUnique({ where: { key: 'wireguard.vps_listen_port' } });

    const vpsPublicKey = vpsPublicKeyConfig?.value ?? '<CLE_PUBLIQUE_VPS>';
    const vpsEndpoint = vpsEndpointConfig?.value ?? '139.84.241.27';
    const vpsListenPort = vpsListenPortConfig?.value ?? '51820';

    const config = `# WireGuard config pour ${router.name}
# Généré automatiquement par MikroServer
# À appliquer sur le routeur MikroTik (IP WireGuard: ${router.wireguardIp})

[Interface]
PrivateKey = <CLE_PRIVEE_ROUTEUR>
Address = ${router.wireguardIp}/32
DNS = 8.8.8.8

[Peer]
PublicKey = ${vpsPublicKey}
Endpoint = ${vpsEndpoint}:${vpsListenPort}
AllowedIPs = 10.66.66.1/32
PersistentKeepalive = 25`;

    return { config, routerName: router.name, wireguardIp: router.wireguardIp };
  }
}
