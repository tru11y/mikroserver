import { apiClient } from './client';

export const sessionsApi = {
  active: (routerId?: string) =>
    apiClient.get(`/sessions/active${routerId ? `?routerId=${routerId}` : ''}`),
  byMac: (macAddress: string, routerId?: string) =>
    apiClient.get('/sessions/by-mac', { params: { macAddress, ...(routerId ? { routerId } : {}) } }),
  terminate: (routerId: string, mikrotikId: string) =>
    apiClient.post('/sessions/terminate', { routerId, mikrotikId }),
  forceDisconnect: (sessionId: string) =>
    apiClient.delete(`/sessions/${sessionId}/disconnect`),
  history: (params?: {
    routerId?: string;
    macAddress?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get('/sessions/history', {
      params: {
        ...params,
        page: params?.page ?? 1,
        limit: params?.limit ?? 50,
      },
    }),
};
