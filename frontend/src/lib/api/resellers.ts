import { apiClient } from './client';

export interface ResellerConfig {
  id: string;
  userId: string;
  parentId: string | null;
  commissionRate: number;
  creditBalance: number;
  totalSales: number;
  totalCommission: number;
  isActive: boolean;
  allowedRouters: string[];
  maxVouchersDay: number | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; phone: string | null; status: string };
}

export interface ResellerVoucher {
  id: string;
  code: string;
  passwordPlain?: string;
  status: string;
  plan: { name: string; priceXof: number };
  createdAt: string;
  expiresAt?: string | null;
}

export interface ResellerMyStats {
  creditBalance: number;
  commissionRate: number;
  totalGenerated: number;
  totalSold: number;
  isActive: boolean;
  recentVouchers: ResellerVoucher[];
}

export interface GenerateVouchersResult {
  vouchers: (ResellerVoucher & { passwordPlain: string })[];
  deducted: number;
}

export const resellersApi = {
  findAll: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/resellers', { params }),
  getStats: () => apiClient.get('/resellers/stats'),
  findOne: (id: string) => apiClient.get(`/resellers/${id}`),
  create: (data: { userId: string; commissionRate?: number; allowedRouters?: string[]; maxVouchersDay?: number }) =>
    apiClient.post('/resellers', data),
  update: (id: string, data: Partial<ResellerConfig>) =>
    apiClient.patch(`/resellers/${id}`, data),
  addCredit: (id: string, amountXof: number) =>
    apiClient.post(`/resellers/${id}/credit`, { amountXof }),
  deactivate: (id: string) => apiClient.delete(`/resellers/${id}`),
  // Self-service (RESELLER role)
  getMyStats: () => apiClient.get<{ data: ResellerMyStats }>('/resellers/me'),
  generateVouchers: (planId: string, quantity: number) =>
    apiClient.post<{ data: GenerateVouchersResult }>('/resellers/me/generate-vouchers', { planId, quantity }),
};
