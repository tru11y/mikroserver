import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const API_URL =
  typeof window !== 'undefined'
    ? window.location.origin + '/proxy'
    : (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000');

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// Request interceptor — attach access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get('access_token');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = Cookies.get('refresh_token');

      if (!refreshToken) {
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve) => {
          subscribeTokenRefresh(resolve);
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post<{
          data: { accessToken: string; refreshToken: string };
        }>(`${API_URL}/api/v1/auth/refresh`, { refreshToken });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
        Cookies.set('access_token', accessToken, { secure: isSecure, sameSite: 'strict' });
        Cookies.set('refresh_token', newRefreshToken, {
          secure: isSecure,
          sameSite: 'strict',
          expires: 30,
        });

        onRefreshed(accessToken);
        isRefreshing = false;

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } catch {
        isRefreshing = false;
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Typed API calls
// ---------------------------------------------------------------------------

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiClient.post('/auth/login', { email, password }),
    logout: (refreshToken: string) =>
      apiClient.post('/auth/logout', { refreshToken }),
    me: () => apiClient.get('/auth/me'),
  },

  metrics: {
    dashboard: () => apiClient.get('/metrics/dashboard'),
    revenueChart: (days = 30) =>
      apiClient.get(`/metrics/revenue-chart?days=${days}`),
  },

  plans: {
    list: (includeArchived = false) =>
      apiClient.get(`/plans?includeArchived=${includeArchived}`),
    create: (data: unknown) => apiClient.post('/plans', data),
    update: (id: string, data: unknown) => apiClient.patch(`/plans/${id}`, data),
    archive: (id: string) => apiClient.delete(`/plans/${id}`),
  },

  transactions: {
    list: (page = 1, limit = 20) =>
      apiClient.get(`/transactions?page=${page}&limit=${limit}`),
    get: (id: string) => apiClient.get(`/transactions/${id}`),
  },

  routers: {
    list: () => apiClient.get('/routers'),
    get: (id: string) => apiClient.get(`/routers/${id}`),
    create: (data: unknown) => apiClient.post('/routers', data),
    update: (id: string, data: unknown) => apiClient.patch(`/routers/${id}`, data),
    remove: (id: string) => apiClient.delete(`/routers/${id}`),
    healthCheck: (id: string) => apiClient.post(`/routers/${id}/health-check`),
    liveStats: (id: string) => apiClient.get(`/routers/${id}/live-stats`),
  },

  settings: {
    get: () => apiClient.get('/settings'),
    update: (data: Record<string, string>) => apiClient.patch('/settings', data),
  },

  vouchers: {
    list: (page = 1, limit = 20) => apiClient.get(`/vouchers?page=${page}&limit=${limit}`),
    get: (id: string) => apiClient.get(`/vouchers/${id}`),
    revoke: (id: string) => apiClient.post(`/vouchers/${id}/revoke`),
    redeliver: (id: string) => apiClient.post(`/vouchers/${id}/redeliver`),
    generateBulk: (data: { planId: string; routerId: string; count: number }) =>
      apiClient.post('/vouchers/generate/bulk', data),
    downloadPdf: (voucherIds: string[], businessName?: string) =>
      apiClient.post('/vouchers/pdf', { voucherIds, businessName }, { responseType: 'blob' }),
  },

  users: {
    list: (role?: string) => apiClient.get(`/users${role ? `?role=${role}` : ''}`),
    resellers: () => apiClient.get('/users/resellers'),
    get: (id: string) => apiClient.get(`/users/${id}`),
    create: (data: unknown) => apiClient.post('/users', data),
    suspend: (id: string) => apiClient.post(`/users/${id}/suspend`),
    activate: (id: string) => apiClient.post(`/users/${id}/activate`),
    remove: (id: string) => apiClient.delete(`/users/${id}`),
  },

  sessions: {
    active: (routerId?: string) =>
      apiClient.get(`/sessions/active${routerId ? `?routerId=${routerId}` : ''}`),
    terminate: (routerId: string, mikrotikId: string) =>
      apiClient.post('/sessions/terminate', { routerId, mikrotikId }),
  },
};
