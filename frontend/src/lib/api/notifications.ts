import { apiClient } from './client';

export type NotificationType =
  | 'NEW_CONNECTION'
  | 'SESSION_EXPIRED'
  | 'PAYMENT_RECEIVED'
  | 'ROUTER_OFFLINE'
  | 'ROUTER_ONLINE'
  | 'VOUCHER_EXPIRING'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SECURITY_ALERT'
  | 'SYSTEM';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  routerId: string | null;
  sessionId: string | null;
  createdAt: string;
}

export interface NotificationList {
  items: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export const notificationsApi = {
  findAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    apiClient.get<{ data: NotificationList }>('/notifications', { params }),

  getUnreadCount: () =>
    apiClient.get<{ data: { count: number } }>('/notifications/unread-count'),

  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.patch('/notifications/read-all'),

  subscribe: (sub: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) =>
    apiClient.post('/notifications/push/subscribe', sub),

  unsubscribe: (endpoint: string) =>
    apiClient.delete('/notifications/push/subscribe', { data: { endpoint } }),
};
