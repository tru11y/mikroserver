import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const WG_SUBNET = "10.66.66";
const WG_SERVER_IP = "10.66.66.1";

/**
 * WireGuard IP Pool — atomic allocation via PostgreSQL advisory lock.
 *
 * WHY advisory lock instead of application-level scan:
 *   Two concurrent `POST /routers` calls both read the DB, both find the same
 *   IP available, both call `addWireGuardPeer()` with it → duplicate-peer
 *   conflict on wg0, one silently overwrites the other's allowed-ips.
 *
 * HOW it works:
 *   `pg_advisory_xact_lock(key)` acquires an exclusive transaction-level
 *   advisory lock. All concurrent callers queue up. Inside the lock we:
 *     1. Scan routers for used wireguardIp AND any ip reserved in metadata.wg
 *     2. Pick the first free IP
 *     3. Write it into metadata.wg.wgIp so it is visible to the *next* caller
 *        before `addWireGuardPeer` is even called
 *   The lock is released when the transaction commits — at that point the IP
 *   is already stored in the DB, so the next waiter will skip it.
 *
 * LOCK KEY: 0x4D4B5F57470000 (ASCII "MK_WG" padded to bigint).
 */
const WG_LOCK_KEY = BigInt("0x4D4B5F574700");

@Injectable()
export class WgIpPoolService {
  private readonly logger = new Logger(WgIpPoolService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically reserve the next free WireGuard IP for `routerId`.
   *
   * The IP is written into the router's metadata.wg.wgIp inside the same
   * transaction that holds the advisory lock — so no other allocator can
   * pick it even before `addWireGuardPeer` is called.
   *
   * Returns the reserved IP.
   * Throws if the /24 subnet is exhausted.
   */
  async allocate(routerId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      // Serialize all concurrent allocations across all app replicas.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${WG_LOCK_KEY})`;

      // Collect every IP that is already spoken for:
      //   - router.wireguardIp  (confirmed tunnel)
      //   - metadata.wg.wgIp   (reserved but tunnel not yet up)
      const rows = await tx.router.findMany({
        where: { deletedAt: null },
        select: { wireguardIp: true, metadata: true },
      });

      const used = new Set<string>([WG_SERVER_IP]);
      for (const r of rows) {
        if (r.wireguardIp) used.add(r.wireguardIp);
        const wg = (r.metadata as Record<string, unknown> | null)?.wg as
          | Record<string, string>
          | undefined;
        if (wg?.wgIp) used.add(wg.wgIp);
      }

      let allocated: string | null = null;
      for (let i = 2; i <= 254; i++) {
        const candidate = `${WG_SUBNET}.${i}`;
        if (!used.has(candidate)) {
          allocated = candidate;
          break;
        }
      }

      if (!allocated) {
        throw new Error(
          "WireGuard subnet exhausted — 10.66.66.2–254 fully allocated.",
        );
      }

      // Reserve immediately in DB so the next waiter sees it as used.
      // The full wg config will be written after key generation.
      //
      // IMPORTANT: Prisma JSON updates are full column replacements — must read
      // the existing metadata first and spread it to preserve localIp/lanIp
      // written during router create(). Without this merge, the safe-onboard
      // path loses the LAN IP and falls back to poll-only mode every time.
      const existing = await tx.router.findUnique({
        where: { id: routerId },
        select: { metadata: true },
      });
      const existingMeta = (existing?.metadata ?? {}) as Record<
        string,
        unknown
      >;

      await tx.router.update({
        where: { id: routerId },
        data: {
          metadata: {
            ...existingMeta,
            wg: {
              wgIp: allocated,
              reservedAt: new Date().toISOString(),
            },
          },
        },
      });

      this.logger.debug(
        `[WgPool] Reserved ${allocated} for router ${routerId}`,
      );
      return allocated;
    });
  }

  /**
   * Release an IP back to the pool (rollback path).
   * Clears the wg metadata reservation so the IP becomes available again.
   */
  async release(routerId: string): Promise<void> {
    try {
      // Surgical removal of only the wg key — preserves localIp/lanIp so a
      // re-provisioning attempt can still detect the LAN address and take the
      // safe-onboard path instead of falling back to poll-only.
      const router = await this.prisma.router.findUnique({
        where: { id: routerId },
        select: { metadata: true },
      });
      const { wg: _wg, ...metaWithoutWg } = (router?.metadata ?? {}) as Record<
        string,
        unknown
      >;
      await this.prisma.router.update({
        where: { id: routerId },
        data: { metadata: metaWithoutWg as Prisma.InputJsonObject },
      });
      this.logger.debug(
        `[WgPool] Released IP reservation for router ${routerId}`,
      );
    } catch {
      // Router may already be deleted — safe to ignore
    }
  }
}
