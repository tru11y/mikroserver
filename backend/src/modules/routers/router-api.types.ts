import { Prisma, RouterStatus } from "@prisma/client";

export interface MikroTikModule {
  getConnection: (
    host: string,
    user: string,
    password: string,
    options?: {
      port?: number;
      timeout?: number;
      closeOnDone?: boolean;
      closeOnTimeout?: boolean;
      tls?: boolean | Record<string, unknown>;
    },
  ) => MikroTikConnection;
  parseItems: <T>(data: unknown) => T[];
}

export interface RouterCredentials {
  id: string;
  wireguardIp: string;
  apiPort: number;
  apiUsername: string;
  apiPasswordHash: string;
}

export interface HotspotUserConfig {
  username: string;
  password: string;
  profile: string;
  comment: string;
  limitUptime: string;
  limitBytesIn?: string;
  limitBytesOut?: string;
}

export interface MikroTikConnection {
  close: () => void;
  openChannel: () => MikroTikChannel;
  getConnectPromise: () => Promise<MikroTikConnection>;
}

export interface MikroTikChannel {
  write: (commands: string[]) => void;
  on: (event: string, handler: (data: unknown) => void) => void;
  once: (event: string, handler: (data: unknown) => void) => void;
}

export interface HotspotActiveClient {
  ".id": string;
  server: string;
  user: string;
  address: string;
  "mac-address": string;
  uptime: string;
  "bytes-in": string;
  "bytes-out": string;
  "packets-in": string;
  "packets-out": string;
}

export interface HotspotUserRecord {
  ".id"?: string;
  name?: string;
  password?: string;
  profile?: string;
  comment?: string;
  disabled?: string | boolean;
  "limit-uptime"?: string;
  uptime?: string;
}

export interface HotspotUserProfileRecord {
  ".id"?: string;
  name?: string;
  "rate-limit"?: string;
  "shared-users"?: string;
  "session-timeout"?: string;
  "idle-timeout"?: string;
  "keepalive-timeout"?: string;
  "address-pool"?: string;
}

export interface HotspotIpBindingRecord {
  ".id"?: string;
  server?: string;
  address?: string;
  "mac-address"?: string;
  type?: string;
  comment?: string;
  disabled?: string | boolean;
  "to-address"?: string;
  "address-list"?: string;
}

export interface HotspotHostRecord {
  ".id"?: string;
  server?: string;
  address?: string;
  "mac-address"?: string;
  user?: string;
  "host-name"?: string;
}

export type HotspotIpBindingType = "regular" | "blocked" | "bypassed";

export interface LegacyTicketLookupResult {
  routerId: string;
  routerName: string;
  code: string;
  active: boolean;
  disabled: boolean;
  planName: string;
  durationMinutes: number;
  deliveredAt: Date | null;
  activatedAt: Date | null;
  expiresAt: Date | null;
  passwordMatches: boolean | null;
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
  syncSummary?: RouterSyncSummary;
}

export interface RouterHealthResult {
  online: boolean;
  /** Actual status written to DB — may differ from `online` when using consecutive-failure threshold */
  newStatus: RouterStatus;
  error?: string;
}

export interface RouterSyncSummary {
  routerId: string;
  activeClients: number;
  matchedVouchers: number;
  activatedVouchers: number;
  disconnectedSessions: number;
  unmatchedUsers: string[];
  fetchedAt: Date;
}

export interface RouterHotspotUserProfile {
  id: string;
  name: string;
  rateLimit: string | null;
  sharedUsers: number | null;
  sessionTimeout: string | null;
  idleTimeout: string | null;
  keepaliveTimeout: string | null;
  addressPool: string | null;
}

export interface RouterHotspotIpBinding {
  id: string;
  server: string | null;
  address: string | null;
  macAddress: string | null;
  type: string | null;
  comment: string | null;
  disabled: boolean;
  toAddress: string | null;
  addressList: string | null;
  resolvedUser: string | null;
  hostName: string | null;
}

export interface RouterHotspotUser {
  id: string;
  username: string;
  profile: string | null;
  comment: string | null;
  disabled: boolean;
  active: boolean;
  activeSessionCount: number;
  activeAddress: string | null;
  activeMacAddress: string | null;
  uptime: string | null;
  limitUptime: string | null;
  managedByMikroServer: boolean;
  planName: string | null;
  planDurationMinutes: number | null;
  voucherStatus: string | null;
  firstConnectionAt: Date | null;
  elapsedSinceFirstConnectionMinutes: number | null;
  voucherExpiresAt: Date | null;
  remainingMinutes: number | null;
  isTariffExpired: boolean | null;
  enforcementStatus:
    | "UNMANAGED"
    | "ACTIVE_OK"
    | "INACTIVE_OK"
    | "EXPIRED_BUT_ACTIVE"
    | "EXPIRED";
}

export interface RouterHotspotUserProfileUpdateResult {
  userId: string;
  username: string;
  profile: string;
  disconnectedSessions: number;
}

export interface RouterInterfaceStats {
  name: string;
  txBytes: number;
  rxBytes: number;
  running: boolean;
}

export interface RouterBandwidthStats {
  totalTxBytes: number;
  totalRxBytes: number;
  activeConnections: number;
  interfaces: RouterInterfaceStats[];
}

export function mergeRouterMetadata(
  currentMetadata: Prisma.JsonValue | null,
  updates: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    currentMetadata &&
    typeof currentMetadata === "object" &&
    !Array.isArray(currentMetadata)
      ? (currentMetadata as Record<string, unknown>)
      : {};

  return {
    ...base,
    ...updates,
  } as Prisma.InputJsonValue;
}
