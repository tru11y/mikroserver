import { apiClient } from './client';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'RESELLER' | 'VIEWER';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  permissionProfile: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  _counts?: { routers: number; vouchers: number };
}

export interface PaginatedUsersResponse {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const usersApi = {
  list: (role?: string) => apiClient.get(`/users${role ? `?role=${role}` : ''}`),
  listPaginated: (params: { page?: number; limit?: number; search?: string; role?: string }) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    return apiClient.get<{ data: PaginatedUsersResponse }>(`/users/paginated?${query.toString()}`);
  },
  resellers: () => apiClient.get('/users/resellers'),
  permissionOptions: () => apiClient.get('/users/permission-options'),
  get: (id: string) => apiClient.get(`/users/${id}`),
  create: (data: unknown) => apiClient.post('/users', data),
  updateProfile: (id: string, data: unknown) =>
    apiClient.put(`/users/${id}/profile`, data),
  updateAccess: (id: string, data: unknown) =>
    apiClient.put(`/users/${id}/access`, data),
  resetPassword: (id: string, data: unknown) =>
    apiClient.put(`/users/${id}/password`, data),
  resetPasswordGenerate: (id: string) =>
    apiClient.post<{ data: { tempPassword: string } }>(`/users/${id}/reset-password-generate`),
  changeRole: (id: string, role: string) =>
    apiClient.patch(`/users/${id}/role`, { role }),
  suspend: (id: string) => apiClient.post(`/users/${id}/suspend`),
  activate: (id: string) => apiClient.post(`/users/${id}/activate`),
  remove: (id: string) => apiClient.delete(`/users/${id}`),
};
