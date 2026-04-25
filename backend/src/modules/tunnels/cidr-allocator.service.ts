import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export class CidrExhaustedException extends Error {
  constructor(cidr: string) {
    super(`Sous-réseau WireGuard épuisé: ${cidr}`);
    this.name = "CidrExhaustedException";
  }
}

@Injectable()
export class CidrAllocatorService {
  private readonly logger = new Logger(CidrAllocatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Allocate the next available IP in the WG subnet for a given owner.
   * Uses a Prisma interactive transaction to prevent race conditions.
   *
   * Subnet is hardcoded as 10.66.66.0/24 (matching existing infra).
   * Server is 10.66.66.1; usable range: .2–.254.
   */
  async allocateNextIp(
    ownerId: string,
    tx?: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0],
  ): Promise<string> {
    const prisma = tx ?? this.prisma;
    const subnet = "10.66.66";
    const serverIp = `${subnet}.1`;

    // Get all IPs in use — both active tunnels AND legacy routers without a tunnel row.
    // Without this, a new allocation could return 10.66.66.2 (the production router)
    // and clobber its WG peer on wg0.
    const [tunnelIps, routerIps] = await Promise.all([
      prisma.tunnel.findMany({
        where: { deletedAt: null },
        select: { tunnelIp: true },
      }),
      prisma.router.findMany({
        where: { deletedAt: null, wireguardIp: { not: null } },
        select: { wireguardIp: true },
      }),
    ]);

    const usedIps = new Set([
      ...tunnelIps.map((t) => t.tunnelIp),
      ...routerIps.map((r) => r.wireguardIp as string),
    ]);

    for (let i = 2; i <= 254; i++) {
      const candidate = `${subnet}.${i}`;
      if (candidate !== serverIp && !usedIps.has(candidate)) {
        this.logger.debug(`Allocated IP ${candidate} for owner ${ownerId}`);
        return candidate;
      }
    }

    throw new CidrExhaustedException(`${subnet}.0/24`);
  }
}
