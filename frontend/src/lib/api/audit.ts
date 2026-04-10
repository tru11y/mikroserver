import { apiClient } from './client';
import { withQuery } from './query';

export const auditApi = {
  logs: (params?: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    routerId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) =>
    apiClient.get(
      withQuery('/audit/logs', {
        page: params?.page,
        limit: params?.limit,
        action: params?.action,
        entityType: params?.entityType,
        entityId: params?.entityId,
        actorId: params?.actorId,
        routerId: params?.routerId,
        search: params?.search,
        startDate: params?.startDate,
        endDate: params?.endDate,
      }),
    ),
};
