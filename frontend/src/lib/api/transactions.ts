import { apiClient } from './client';

export const transactionsApi = {
  list: (page = 1, limit = 20) =>
    apiClient.get(`/transactions?page=${page}&limit=${limit}`),
  get: (id: string) => apiClient.get(`/transactions/${id}`),
};
