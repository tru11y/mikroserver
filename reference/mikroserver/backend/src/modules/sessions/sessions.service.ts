import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RouterApiService } from '../routers/router-api.service';

export interface ActiveSessionView {
  id: string;
  routerId: string;
  routerName: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routerApiService: RouterApiService,
  ) {}

  async findActive(routerId?: string) {
    const routers = await this.prisma.router.findMany({
      where: {
        deletedAt: null,
        ...(routerId ? { id: routerId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const statsResults = await Promise.allSettled(
      routers.map(async (router) => {
        const stats = await this.routerApiService.getLiveStats(router.id);
        return stats.clients.map<ActiveSessionView>((client) => ({
          id: client.id,
          routerId: router.id,
          routerName: router.name,
          username: client.username,
          ipAddress: client.ipAddress,
          macAddress: client.macAddress,
          uptime: client.uptime,
          bytesIn: client.bytesIn,
          bytesOut: client.bytesOut,
        }));
      }),
    );

    return statsResults
      .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
      .sort((a, b) => b.bytesIn - a.bytesIn);
  }

  async terminate(routerId: string, mikrotikId: string) {
    await this.routerApiService.disconnectActiveSession(routerId, mikrotikId);
    return { success: true };
  }
}
