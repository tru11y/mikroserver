export interface AuditActor {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuditRouter {
  id: string;
  name: string;
}

export interface AuditItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  description: string | null;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  actor: AuditActor | null;
  router: AuditRouter | null;
  changeKeys: string[];
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
}

export interface AuditSummary {
  total: number;
  today: number;
  create: number;
  update: number;
  delete: number;
  security: number;
}

export interface AuditPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditResponse {
  summary: AuditSummary;
  pagination: AuditPagination;
  filters: {
    actions: string[];
    entityTypes: string[];
  };
  items: AuditItem[];
}

export interface AuditQueryParams {
  page: number;
  limit: number;
  action?: string;
  entityType?: string;
  search?: string;
  startDate: string;
  endDate: string;
}
