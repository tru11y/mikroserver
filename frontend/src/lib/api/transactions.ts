import { apiClient } from './client';

export interface TransactionApiFilters {
  status?: string;
  from?: string;
  to?: string;
}

export const transactionsApi = {
  list: (page = 1, limit = 20, filters?: TransactionApiFilters) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (filters?.status) params.set('status', filters.status);
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    return apiClient.get(`/transactions?${params.toString()}`);
  },
  get: (id: string) => apiClient.get(`/transactions/${id}`),
  summary: () => apiClient.get('/transactions/summary'),
};
