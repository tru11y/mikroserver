import { apiClient } from './client';

export const settingsApi = {
  get: () => apiClient.get('/settings'),
  update: (data: Record<string, string>) => apiClient.patch('/settings', data),
};
