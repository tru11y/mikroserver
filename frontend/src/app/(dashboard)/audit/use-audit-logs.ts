import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { AuditResponse, AuditQueryParams } from './audit.types';

export function useAuditLogs(params: AuditQueryParams, enabled: boolean) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => {
      const res = await api.audit.logs({
        page: params.page,
        limit: params.limit,
        action: params.action,
        entityType: params.entityType,
        search: params.search,
        startDate: params.startDate,
        endDate: params.endDate,
      });
      return unwrap<AuditResponse>(res);
    },
    enabled,
  });
}
