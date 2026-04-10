import { apiClient } from './client';
import { withQuery } from './query';

export const metricsApi = {
  dashboard: () => apiClient.get('/metrics/dashboard'),
  dashboardStats: () => apiClient.get('/metrics/dashboard/stats'),
  incidents: () => apiClient.get('/metrics/incidents'),
  revenueChart: (days = 30) => apiClient.get(`/metrics/revenue-chart?days=${days}`),
  subscriptionsToday: () => apiClient.get('/metrics/subscriptions/today'),
  subscriptionsExpiringToday: () =>
    apiClient.get('/metrics/subscriptions/expiring-today'),
  topRecurringClients: (windowDays = 30, limit = 10) =>
    apiClient.get(
      `/metrics/subscriptions/top-clients?windowDays=${windowDays}&limit=${limit}`,
    ),
  topRecurringPlans: (windowDays = 30, limit = 10) =>
    apiClient.get(
      `/metrics/subscriptions/top-plans?windowDays=${windowDays}&limit=${limit}`,
    ),
  dailyRecommendations: () => apiClient.get('/metrics/recommendations/daily'),
  ticketReport: (params?: {
    startDate?: string;
    endDate?: string;
    operatorId?: string;
    planId?: string;
  }) =>
    apiClient.get(
      withQuery('/metrics/ticket-report', {
        startDate: params?.startDate,
        endDate: params?.endDate,
        operatorId: params?.operatorId,
        planId: params?.planId,
      }),
    ),
  exportTicketReport: (params?: {
    startDate?: string;
    endDate?: string;
    operatorId?: string;
    planId?: string;
  }) =>
    apiClient.get(
      withQuery('/metrics/ticket-report/export', {
        startDate: params?.startDate,
        endDate: params?.endDate,
        operatorId: params?.operatorId,
        planId: params?.planId,
      }),
      { responseType: 'blob' },
    ),
};
