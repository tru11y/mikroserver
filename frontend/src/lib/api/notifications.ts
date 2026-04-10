import { apiClient } from './client';

export interface Notification {
  id: string;
  type: string;
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
