import { apiClient } from './client';

export const plansApi = {
  list: (includeArchived = false) =>
    apiClient.get(`/plans?includeArchived=${includeArchived}`),
  publicList: () => apiClient.get('/plans/public'),
  create: (data: unknown) => apiClient.post('/plans', data),
  update: (id: string, data: unknown) => apiClient.patch(`/plans/${id}`, data),
  delete: (id: string) => apiClient.delete(`/plans/${id}`),
  archive: (id: string) => apiClient.patch(`/plans/${id}/archive`, {}),
  restore: (id: string) => apiClient.patch(`/plans/${id}/restore`, {}),
};
