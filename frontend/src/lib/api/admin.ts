import { apiClient } from './client';

export interface SaasTier {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceXofMonthly: number;
  priceXofYearly: number | null;
  maxRouters: number | null;
  maxMonthlyTx: number | null;
  maxResellers: number | null;
  isFree: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface OperatorSubscription {
  id: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'SUSPENDED' | 'TRIAL';
  billingCycle: 'MONTHLY' | 'YEARLY';
  startDate: string;
  endDate: string;
  priceXof: number;
  tier: SaasTier;
}

export interface Operator {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: string;
  tierName: string | null;
  tierSlug: string | null;
  subscriptionStatus: string | null;
  subscriptionEndDate: string | null;
  routerCount: number;
  activeRouterCount: number;
  totalVouchers: number;
  revenueThisMonthXof: number;
  revenueTotalXof: number;
}

export interface ProvisionResult {
  operator: Operator;
  tempPassword: string;
  subscription: OperatorSubscription | null;
}

export const adminApi = {
  // Operators
  listOperators: (page = 1, limit = 25) =>
    apiClient.get<{ data: { items: Operator[]; total: number } }>(
      `/admin/operators?page=${page}&limit=${limit}`,
    ),

  getOperator: (id: string) =>
    apiClient.get<{ data: Operator }>(`/admin/operators/${id}`),

  provisionOperator: (data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    tierId?: string;
    billingCycle?: 'MONTHLY' | 'YEARLY';
  }) => apiClient.post<{ data: ProvisionResult }>('/admin/operators', data),

  // Subscriptions
  listSubscriptions: (page = 1, limit = 25) =>
    apiClient.get(`/admin/subscriptions?page=${page}&limit=${limit}`),

  getOperatorSubscription: (operatorId: string) =>
    apiClient.get<{ data: OperatorSubscription | null }>(
      `/admin/operators/${operatorId}/subscription`,
    ),

  assignSubscription: (operatorId: string, tierId: string, billingCycle: 'MONTHLY' | 'YEARLY') =>
    apiClient.post(`/admin/operators/${operatorId}/subscription`, {
      tierId,
      billingCycle,
    }),

  renewSubscription: (operatorId: string, months?: number) =>
    apiClient.post(`/admin/operators/${operatorId}/subscription/renew`, {
      months,
    }),

  cancelSubscription: (operatorId: string, reason?: string) =>
    apiClient.delete(`/admin/operators/${operatorId}/subscription`, {
      data: { reason },
    }),

  // Tiers
  listTiers: () =>
    apiClient.get<{ data: SaasTier[] }>('/admin/tiers'),
};
