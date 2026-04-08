import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import CircuitBreaker from 'opossum';
import { PrismaService } from '../prisma/prisma.service';
import { RouterStatus, VoucherStatus } from '@prisma/client';

// MikroTik RouterOS API client
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MikroNode = require('mikrotik');

interface RouterCredentials {
  id: string;
  wireguardIp: string;
  apiPort: number;
  apiUsername: string;
  apiPasswordHash: string; // We store plaintext in a separate field in practice
}

interface HotspotUserConfig {
  username: string;
  password: string;
  profile: string;
  comment: string;
  limitUptime: string;     // e.g. "1d" or "01:00:00"
  limitBytesIn?: string;
  limitBytesOut?: string;
}

interface MikroTikConnection {
  close: () => void;
  openChannel: () => MikroTikChannel;
}

interface MikroTikChannel {
  write: (commands: string[]) => void;
  on: (event: string, handler: (data: unknown) => void) => void;
  once: (event: string, handler: (data: unknown) => void) => void;
}

interface HotspotActiveClient {
  '.id': string;
  server: string;
  user: string;
  address: string;
  'mac-address': string;
  uptime: string;
  'bytes-in': string;
  'bytes-out': string;
  'packets-in': string;
  'packets-out': string;
}

export interface RouterLiveStats {
  routerId: string;
  activeClients: number;
  totalBytesIn: number;
  totalBytesOut: number;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  clients: Array<{
    id: string;
    username: string;
    ipAddress: string;
    macAddress: string;
    uptime: string;
    bytesIn: number;
    bytesOut: number;
  }>;
  fetchedAt: Date;
}

/**
 * RouterOS API Integration Service
 *
 * ARCHITECTURAL DECISIONS:
 * 1. Circuit breaker per-router via opossum — prevents cascade failures
 *    when a router is offline. After 50% failure rate, opens circuit for 30s.
 * 2. Connection per-operation (no persistent connection pool) — RouterOS API
 *    connections are cheap and long-lived connections cause issues.
 * 3. All operations wrapped in try/finally to ensure connections are closed.
 * 4. Router credentials stored encrypted (password in separate table in prod).
 * 5. WireGuard tunnel ensures all API traffic is encrypted.
 */

@Injectable()
export class RouterApiService {
  private readonly logger = new Logger(RouterApiService.name);

  // Circuit breakers per router (keyed by routerId)
  private readonly circuitBreakers = new Map<
    string,
    CircuitBreaker<[RouterCredentials, HotspotUserConfig], void>
  >();

  // Last bandwidth poll per router for delta computation
  private readonly lastPoll = new Map<string, { time: number; bytesIn: number; bytesOut: number }>();

  private readonly cbTimeout: number;
  private readonly cbResetMs: number;
  private readonly cbThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.cbTimeout = this.configService.get<number>(
      'CIRCUIT_BREAKER_TIMEOUT_MS',
      10000,
    );
    this.cbResetMs = this.configService.get<number>(
      'CIRCUIT_BREAKER_RESET_MS',
      30000,
    );
    this.cbThreshold = this.configService.get<number>(
      'CIRCUIT_BREAKER_THRESHOLD',
      50,
    );
  }

  // ---------------------------------------------------------------------------
  // Push Hotspot User to MikroTik
  // ---------------------------------------------------------------------------

  async pushHotspotUser(
    routerId: string,
    voucherId: string,
    config: HotspotUserConfig,
  ): Promise<void> {
    const router = await this.prisma.router.findUniqueOrThrow({
      where: { id: routerId, deletedAt: null },
    });

    const credentials: RouterCredentials = {
      id: router.id,
      wireguardIp: router.wireguardIp,
      apiPort: router.apiPort,
      apiUsername: router.apiUsername,
      apiPasswordHash: router.apiPasswordHash, // plain password stored here
    };

    const breaker = this.getOrCreateBreaker(routerId);

    try {
      await breaker.fire(credentials, config);

      // Update voucher status to DELIVERED
      await this.prisma.voucher.update({
        where: { id: voucherId },
        data: {
          status: VoucherStatus.DELIVERED,
          deliveredAt: new Date(),
          routerId,
        },
      });

      // Update router last seen
      await this.prisma.router.update({
        where: { id: routerId },
        data: { lastSeenAt: new Date(), status: RouterStatus.ONLINE },
      });

      this.logger.log(
        `Voucher ${voucherId} delivered to router ${router.name} (${router.wireguardIp})`,
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);

      await this.prisma.voucher.update({
        where: { id: voucherId },
        data: {
          status: VoucherStatus.DELIVERY_FAILED,
          deliveryAttempts: { increment: 1 },
          lastDeliveryError: errMsg.slice(0, 1000),
        },
      });

      if (breaker.opened) {
        await this.prisma.router.update({
          where: { id: routerId },
          data: { status: RouterStatus.OFFLINE },
        });
        this.logger.error(
          `Circuit breaker OPEN for router ${router.name} — marking offline`,
        );
      }

      throw new ServiceUnavailableException(
        `Router delivery failed: ${errMsg}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Delete Hotspot User (revocation)
  // ---------------------------------------------------------------------------

  async removeHotspotUser(routerId: string, username: string): Promise<void> {
    const router = await this.prisma.router.findUniqueOrThrow({
      where: { id: routerId, deletedAt: null },
    });

    await this.executeOnRouter(
      router.wireguardIp,
      router.apiPort,
      router.apiUsername,
      router.apiPasswordHash,
      async (conn) => {
        const userIds = await this.findHotspotUserIds(conn, username);
        for (const userId of userIds) {
          await this.removeById(conn, '/ip/hotspot/user/remove', userId);
        }
      },
    );

    this.logger.log(`Removed hotspot user ${username} from router ${router.wireguardIp}`);
  }

  async disconnectActiveSessionsByUsername(
    routerId: string,
    username: string,
  ): Promise<number> {
    const router = await this.prisma.router.findUniqueOrThrow({
      where: { id: routerId, deletedAt: null },
    });

    const removedCount = await this.executeOnRouterResult<number>(
      router.wireguardIp,
      router.apiPort,
      router.apiUsername,
      router.apiPasswordHash,
      async (conn) => {
        const activeIds = await this.findActiveSessionIds(conn, username);
        for (const activeId of activeIds) {
          await this.removeById(conn, '/ip/hotspot/active/remove', activeId);
        }
        return activeIds.length;
      },
    );

    this.logger.log(
      `Disconnected ${removedCount} active session(s) for ${username} on router ${router.wireguardIp}`,
    );

    return removedCount;
  }

  async disconnectActiveSession(
    routerId: string,
    mikrotikId: string,
  ): Promise<void> {
    const router = await this.prisma.router.findUniqueOrThrow({
      where: { id: routerId, deletedAt: null },
    });

    await this.executeOnRouter(
      router.wireguardIp,
      router.apiPort,
      router.apiUsername,
      router.apiPasswordHash,
      async (conn) => {
        await this.removeById(conn, '/ip/hotspot/active/remove', mikrotikId);
      },
    );

    this.logger.log(
      `Disconnected active session ${mikrotikId} from router ${router.wireguardIp}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Live stats — active clients + bandwidth from MikroTik
  // ---------------------------------------------------------------------------

  async getLiveStats(routerId: string): Promise<RouterLiveStats> {
    const router = await this.prisma.router.findUniqueOrThrow({
      where: { id: routerId, deletedAt: null },
    });

    const rawClients = await this.executeOnRouterResult<HotspotActiveClient[]>(
      router.wireguardIp,
      router.apiPort,
      router.apiUsername,
      router.apiPasswordHash,
      async (conn) => {
        const channel = conn.openChannel();
        return new Promise<HotspotActiveClient[]>((resolve, reject) => {
          const rows: HotspotActiveClient[] = [];
          channel.write(['/ip/hotspot/active/print']);
          channel.on('re', (data: unknown) => rows.push(data as HotspotActiveClient));
          channel.on('trap', reject);
          channel.once('done', () => resolve(rows));
        });
      },
    );

    const totalBytesIn = rawClients.reduce((s, c) => s + parseInt(c['bytes-in'] || '0', 10), 0);
    const totalBytesOut = rawClients.reduce((s, c) => s + parseInt(c['bytes-out'] || '0', 10), 0);

    // Delta bandwidth calculation
    const now = Date.now();
    const last = this.lastPoll.get(routerId);
    let rxBytesPerSec = 0;
    let txBytesPerSec = 0;

    if (last && now > last.time) {
      const dtSec = (now - last.time) / 1000;
      rxBytesPerSec = Math.max(0, Math.round((totalBytesIn - last.bytesIn) / dtSec));
      txBytesPerSec = Math.max(0, Math.round((totalBytesOut - last.bytesOut) / dtSec));
    }
    this.lastPoll.set(routerId, { time: now, bytesIn: totalBytesIn, bytesOut: totalBytesOut });

    // Mark router online
    await this.prisma.router.update({
      where: { id: routerId },
      data: { status: RouterStatus.ONLINE, lastSeenAt: new Date() },
    });

    return {
      routerId,
      activeClients: rawClients.length,
      totalBytesIn,
      totalBytesOut,
      rxBytesPerSec,
      txBytesPerSec,
      clients: rawClients.map((c) => ({
        id: c['.id'],
        username: c.user,
        ipAddress: c.address,
        macAddress: c['mac-address'],
        uptime: c.uptime,
        bytesIn: parseInt(c['bytes-in'] || '0', 10),
        bytesOut: parseInt(c['bytes-out'] || '0', 10),
      })),
      fetchedAt: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // Health check a router
  // ---------------------------------------------------------------------------

  async checkRouterHealth(routerId: string): Promise<boolean> {
    const router = await this.prisma.router.findUnique({
      where: { id: routerId, deletedAt: null },
    });

    if (!router) return false;

    try {
      await this.executeOnRouter(
        router.wireguardIp,
        router.apiPort,
        router.apiUsername,
        router.apiPasswordHash,
        async (conn) => {
          const channel = conn.openChannel();
          await new Promise<void>((resolve, reject) => {
            channel.write(['/system/identity/print']);
            channel.on('trap', reject);
            channel.once('done', () => resolve());
          });
        },
      );

      await this.prisma.router.update({
        where: { id: routerId },
        data: {
          status: RouterStatus.ONLINE,
          lastHeartbeatAt: new Date(),
          lastSeenAt: new Date(),
        },
      });

      return true;
    } catch {
      await this.prisma.router.update({
        where: { id: routerId },
        data: { status: RouterStatus.OFFLINE },
      });
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getOrCreateBreaker(
    routerId: string,
  ): CircuitBreaker<[RouterCredentials, HotspotUserConfig], void> {
    if (!this.circuitBreakers.has(routerId)) {
      const breaker = new CircuitBreaker(
        async (creds: RouterCredentials, config: HotspotUserConfig) => {
          await this.executeOnRouter(
            creds.wireguardIp,
            creds.apiPort,
            creds.apiUsername,
            creds.apiPasswordHash,
            async (conn) => {
              await this.addHotspotUser(conn, config);
            },
          );
        },
        {
          timeout: this.cbTimeout,
          errorThresholdPercentage: this.cbThreshold,
          resetTimeout: this.cbResetMs,
          volumeThreshold: 5,
          name: `router-${routerId}`,
        },
      );

      breaker.on('open', () =>
        this.logger.error(`Circuit OPEN for router ${routerId}`),
      );
      breaker.on('halfOpen', () =>
        this.logger.warn(`Circuit HALF-OPEN for router ${routerId}`),
      );
      breaker.on('close', () =>
        this.logger.log(`Circuit CLOSED for router ${routerId}`),
      );

      this.circuitBreakers.set(routerId, breaker);
    }

    return this.circuitBreakers.get(routerId)!;
  }

  private async executeOnRouterResult<T>(
    wireguardIp: string,
    apiPort: number,
    username: string,
    password: string,
    operation: (conn: MikroTikConnection) => Promise<T>,
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const conn: MikroTikConnection = await MikroNode.connect({
      host: wireguardIp,
      port: apiPort,
      user: username,
      password,
      timeout: this.cbTimeout / 1000,
    });
    try {
      return await operation(conn);
    } finally {
      conn.close();
    }
  }

  private async executeOnRouter(
    wireguardIp: string,
    apiPort: number,
    username: string,
    password: string,
    operation: (conn: MikroTikConnection) => Promise<void>,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const conn: MikroTikConnection = await MikroNode.connect({
      host: wireguardIp,
      port: apiPort,
      user: username,
      password,
      timeout: this.cbTimeout / 1000,
    });

    try {
      await operation(conn);
    } finally {
      conn.close();
    }
  }

  private async addHotspotUser(
    conn: MikroTikConnection,
    config: HotspotUserConfig,
  ): Promise<void> {
    const channel = conn.openChannel();

    await new Promise<void>((resolve, reject) => {
      const commands = [
        '/ip/hotspot/user/add',
        `=name=${config.username}`,
        `=password=${config.password}`,
        `=profile=${config.profile}`,
        `=comment=${config.comment}`,
        `=limit-uptime=${config.limitUptime}`,
      ];

      if (config.limitBytesIn) {
        commands.push(`=limit-bytes-in=${config.limitBytesIn}`);
      }
      if (config.limitBytesOut) {
        commands.push(`=limit-bytes-out=${config.limitBytesOut}`);
      }

      channel.write(commands);
      channel.on('trap', (err: unknown) => {
        const msg = typeof err === 'object' && err !== null
          ? JSON.stringify(err)
          : String(err);
        reject(new Error(`RouterOS trap: ${msg}`));
      });
      channel.once('done', () => resolve());
    });
  }

  private async findHotspotUserIds(
    conn: MikroTikConnection,
    username: string,
  ): Promise<string[]> {
    return this.findIds(conn, '/ip/hotspot/user/print', 'name', username);
  }

  private async findActiveSessionIds(
    conn: MikroTikConnection,
    username: string,
  ): Promise<string[]> {
    return this.findIds(conn, '/ip/hotspot/active/print', 'user', username);
  }

  private async findIds(
    conn: MikroTikConnection,
    command: string,
    fieldName: 'name' | 'user',
    value?: string,
  ): Promise<string[]> {
    const channel = conn.openChannel();

    return new Promise<string[]>((resolve, reject) => {
      const ids: string[] = [];
      const commands = [command];
      if (value) {
        commands.push(`?${fieldName}=${value}`);
      }

      channel.write(commands);
      channel.on('re', (data: unknown) => {
        const row = data as { '.id'?: string };
        if (row['.id']) {
          ids.push(row['.id']);
        }
      });
      channel.on('trap', reject);
      channel.once('done', () => resolve(ids));
    });
  }

  private async removeById(
    conn: MikroTikConnection,
    command: '/ip/hotspot/user/remove' | '/ip/hotspot/active/remove',
    id: string,
  ): Promise<void> {
    const channel = conn.openChannel();

    await new Promise<void>((resolve, reject) => {
      channel.write([command, `=.id=${id}`]);
      channel.on('trap', reject);
      channel.once('done', () => resolve());
    });
  }
}
