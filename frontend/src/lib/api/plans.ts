import { apiClient } from './client';

export const plansApi = {
  list: (includeArchived = false) =>
    apiClient.get(`/plans?includeArchived=${includeArchived}`),
  publicList: () => apiClient.get('/plans/public'),
  create: (data: unknown) => apiClient.post('/plans', data),
  update: (id: string, data: unknown) => apiClient.patch(`/plans/${id}`, data),
  archive: (id: string) => apiClient.delete(`/plans/${id}`),
};
