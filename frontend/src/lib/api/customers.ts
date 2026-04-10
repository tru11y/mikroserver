import { apiClient } from './client';

export interface CustomerProfile {
  id: string;
  macAddress: string;
  routerId: string;
  lastUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  totalSessions: number;
  totalDataBytes: string; // BigInt as string
  totalSpentXof: number;
  isBlocked: boolean;
  notes: string | null;
  router: { id: string; name: string };
}

export const customersApi = {
  findAll: (params?: { routerId?: string; page?: number; limit?: number; search?: string }) =>
    apiClient.get('/customers', { params }),
  getStats: (routerId?: string) =>
    apiClient.get('/customers/stats', { params: routerId ? { routerId } : {} }),
  findOne: (id: string) => apiClient.get(`/customers/${id}`),
  update: (id: string, data: { firstName?: string; lastName?: string; phone?: string; notes?: string }) =>
    apiClient.patch(`/customers/${id}`, data),
  block: (id: string, isBlocked: boolean) =>
    apiClient.patch(`/customers/${id}/block`, { isBlocked }),
  delete: (id: string) => apiClient.delete(`/customers/${id}`),
};
