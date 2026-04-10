export type RouterStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'MAINTENANCE';

export type RouterItemMetadata = {
  lastActiveClients?: number;
  lastMatchedVouchers?: number;
  lastActivatedVouchers?: number;
  lastDisconnectedSessions?: number;
  lastUnmatchedUsers?: string[];
  lastHealthCheckAt?: string;
  lastHealthCheckError?: string | null;
  lastSyncAt?: string;
  lastSyncError?: string | null;
  /** Number of consecutive health check failures (reset to 0 on success). Reaches 2 before OFFLINE flip. */
  consecutiveHealthFailures?: number;
};

export type RouterItem = {
  id: string;
  name: string;
  description?: string | null;
  location?: string | null;
  site?: string | null;
  tags: string[];
  wireguardIp: string | null;
  apiPort: number;
  apiUsername: string;
  hotspotProfile: string;
  hotspotServer: string;
  status: RouterStatus;
  lastSeenAt?: string | null;
  metadata?: RouterItemMetadata | null;
};

export type RouterFormState = {
  name: string;
  description: string;
  location: string;
  site: string;
  tags: string;
  wireguardIp: string;
  apiPort: string;
  apiUsername: string;
  apiPassword: string;
  hotspotProfile: string;
  hotspotServer: string;
  ownerId: string;
};

export type BulkAction =
  | 'HEALTH_CHECK'
  | 'SYNC'
  | 'ENABLE_MAINTENANCE'
  | 'DISABLE_MAINTENANCE';
