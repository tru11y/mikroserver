export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentEntityType = 'router' | 'voucher' | 'queue' | 'system';

export interface IncidentSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  offlineRouters: number;
  degradedRouters: number;
  routersWithSyncErrors: number;
  routersWithUnmatchedUsers: number;
  deliveryFailures: number;
  voucherQueueBacklog: number;
  webhookQueueBacklog: number;
}

export interface IncidentItem {
  id: string;
  severity: IncidentSeverity;
  type: string;
  title: string;
  description: string;
  detectedAt: string;
  entityType: IncidentEntityType;
  entityId?: string;
  routerId?: string;
  routerName?: string;
  metadata?: Record<string, unknown>;
}

export interface IncidentCenterResponse {
  summary: IncidentSummary;
  incidents: IncidentItem[];
  generatedAt: string;
}

export interface GroupedIncidents {
  critical: IncidentItem[];
  high: IncidentItem[];
  medium: IncidentItem[];
  low: IncidentItem[];
}
