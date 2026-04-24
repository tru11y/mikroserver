export interface RouterMetadata {
  lastHealthCheckAt?: string;
  lastHealthCheckError?: string | null;
  lastSyncAt?: string;
  lastSyncError?: string | null;
  lastActiveClients?: number;
  lastMatchedVouchers?: number;
  lastActivatedVouchers?: number;
  lastDisconnectedSessions?: number;
  lastUnmatchedUsers?: string[];
  consecutiveHealthFailures?: number;
}

export interface RouterDetail {
  id: string;
  name: string;
  location?: string;
  wireguardIp: string | null;
  apiPort: number;
  apiUsername: string;
  hotspotProfile: string;
  hotspotServer: string;
  status: string;
  lastSeenAt?: string;
  metadata?: RouterMetadata | null;
}

export interface LiveClient {
  id: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
}

export interface SyncSummary {
  routerId: string;
  activeClients: number;
  matchedVouchers: number;
  activatedVouchers: number;
  disconnectedSessions: number;
  unmatchedUsers: string[];
  fetchedAt: string;
}

export interface LiveStats {
  routerId: string;
  activeClients: number;
  totalBytesIn: number;
  totalBytesOut: number;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  clients: LiveClient[];
  fetchedAt: string;
  syncSummary?: SyncSummary;
}

export interface HotspotProfile {
  id: string;
  name: string;
  rateLimit: string | null;
  sharedUsers: number | null;
  sessionTimeout: string | null;
  idleTimeout: string | null;
  keepaliveTimeout: string | null;
  addressPool: string | null;
}

export interface HotspotIpBinding {
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

export interface HotspotUserRow {
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
  firstConnectionAt: string | null;
  elapsedSinceFirstConnectionMinutes: number | null;
  voucherExpiresAt: string | null;
  remainingMinutes: number | null;
  isTariffExpired: boolean | null;
  enforcementStatus:
    | 'UNMANAGED'
    | 'ACTIVE_OK'
    | 'INACTIVE_OK'
    | 'EXPIRED_BUT_ACTIVE'
    | 'EXPIRED';
}

export interface PlanSummary {
  id: string;
  name: string;
  status: string;
  priceXof: number;
  durationMinutes: number;
  userProfile?: string | null;
}

export type IpBindingType = 'regular' | 'blocked' | 'bypassed';

export type RouterDetailSection = 'live' | 'profiles' | 'bindings' | 'users' | 'migration' | 'history' | 'terminal' | 'access';

export interface RouterAccessCredentials {
  routerId: string;
  routerName: string;
  vpnIp: string;
  winbox: {
    address: string;
    port: number;
    username: string;
    password: string | null;
    deepLink: string;
  };
  webfig: {
    url: string;
    port: number;
    username: string;
    password: string | null;
  };
  ssh: {
    command: string;
    host: string;
    port: number;
    username: string;
    password: string | null;
  };
}

export interface RouterMigrationPreview {
  code: string;
  remainingMinutes: number;
  newVoucherId?: string;
}

export interface RouterMigrationResult {
  dryRun: boolean;
  sourceRouterId: string;
  targetRouterId: string;
  count: number;
  migrations: RouterMigrationPreview[];
  failed?: string[];
}
