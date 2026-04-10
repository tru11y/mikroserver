import { apiClient, ROUTER_HEAVY_TIMEOUT_MS } from './client';
import { withQuery } from './query';

const withRouterHeavyTimeout = { timeout: ROUTER_HEAVY_TIMEOUT_MS };

export const routersApi = {
  list: (params?: {
    status?: string;
    site?: string;
    tag?: string;
    search?: string;
  }) =>
    apiClient.get(
      withQuery('/routers', {
        status:
          params?.status && params.status !== 'ALL' ? params.status : undefined,
        site: params?.site,
        tag: params?.tag,
        search: params?.search,
      }),
    ),
  get: (id: string) => apiClient.get(`/routers/${id}`),
  create: (data: unknown) => apiClient.post('/routers', data),
  update: (id: string, data: unknown) => apiClient.patch(`/routers/${id}`, data),
  remove: (id: string) => apiClient.delete(`/routers/${id}`),
  healthCheck: (id: string) =>
    apiClient.post(`/routers/${id}/health-check`, undefined, withRouterHeavyTimeout),
  sync: (id: string) =>
    apiClient.post(`/routers/${id}/sync`, undefined, withRouterHeavyTimeout),
  liveStats: (id: string) =>
    apiClient.get(`/routers/${id}/live-stats`, withRouterHeavyTimeout),
  bandwidthStats: (id: string) =>
    apiClient.get(`/routers/${id}/stats`, withRouterHeavyTimeout),
  hotspotProfiles: (id: string) =>
    apiClient.get(`/routers/${id}/hotspot/user-profiles`, withRouterHeavyTimeout),
  createHotspotProfile: (
    id: string,
    data: {
      name: string;
      rateLimit?: string;
      sharedUsers?: number;
      sessionTimeout?: string;
      idleTimeout?: string;
      keepaliveTimeout?: string;
      addressPool?: string;
    },
  ) => apiClient.post(`/routers/${id}/hotspot/user-profiles`, data),
  updateHotspotProfile: (
    id: string,
    profileId: string,
    data: {
      name?: string;
      rateLimit?: string;
      sharedUsers?: number;
      sessionTimeout?: string;
      idleTimeout?: string;
      keepaliveTimeout?: string;
      addressPool?: string;
    },
  ) =>
    apiClient.patch(
      `/routers/${id}/hotspot/user-profiles/${encodeURIComponent(profileId)}`,
      data,
    ),
  removeHotspotProfile: (id: string, profileId: string) =>
    apiClient.delete(
      `/routers/${id}/hotspot/user-profiles/${encodeURIComponent(profileId)}`,
    ),
  ipBindings: (id: string) =>
    apiClient.get(`/routers/${id}/hotspot/ip-bindings`, withRouterHeavyTimeout),
  createIpBinding: (
    id: string,
    data: {
      server?: string;
      address?: string;
      macAddress?: string;
      type?: 'regular' | 'blocked' | 'bypassed';
      comment?: string;
      toAddress?: string;
      addressList?: string;
      disabled?: boolean;
    },
  ) => apiClient.post(`/routers/${id}/hotspot/ip-bindings`, data),
  updateIpBinding: (
    id: string,
    bindingId: string,
    data: {
      server?: string;
      address?: string;
      macAddress?: string;
      type?: 'regular' | 'blocked' | 'bypassed';
      comment?: string;
      toAddress?: string;
      addressList?: string;
      disabled?: boolean;
    },
  ) =>
    apiClient.patch(
      `/routers/${id}/hotspot/ip-bindings/${encodeURIComponent(bindingId)}`,
      data,
    ),
  removeIpBinding: (id: string, bindingId: string) =>
    apiClient.delete(
      `/routers/${id}/hotspot/ip-bindings/${encodeURIComponent(bindingId)}`,
    ),
  blockIpBinding: (id: string, bindingId: string) =>
    apiClient.post(
      `/routers/${id}/hotspot/ip-bindings/${encodeURIComponent(bindingId)}/block`,
    ),
  unblockIpBinding: (id: string, bindingId: string) =>
    apiClient.post(
      `/routers/${id}/hotspot/ip-bindings/${encodeURIComponent(bindingId)}/unblock`,
    ),
  enableIpBinding: (id: string, bindingId: string) =>
    apiClient.post(
      `/routers/${id}/hotspot/ip-bindings/${encodeURIComponent(bindingId)}/enable`,
    ),
  disableIpBinding: (id: string, bindingId: string) =>
    apiClient.post(
      `/routers/${id}/hotspot/ip-bindings/${encodeURIComponent(bindingId)}/disable`,
    ),
  hotspotUsers: (id: string, search?: string) =>
    apiClient.get(
      withQuery(`/routers/${id}/hotspot/users`, {
        search,
      }),
      withRouterHeavyTimeout,
    ),
  updateHotspotUserProfile: (
    id: string,
    data: { userId: string; profile: string; disconnectActive?: boolean },
  ) => apiClient.patch(`/routers/${id}/hotspot/users/profile`, data),
  getBootstrap: (id: string) => apiClient.get(`/routers/${id}/bootstrap`),
  bulkAction: (
    routerIds: string[],
    action:
      | 'HEALTH_CHECK'
      | 'SYNC'
      | 'ENABLE_MAINTENANCE'
      | 'DISABLE_MAINTENANCE',
  ) => apiClient.post('/routers/bulk-actions', { routerIds, action }),
  disconnectByUsername: (id: string, username: string) =>
    apiClient.post(
      `/routers/${id}/hotspot/active/disconnect-by-username`,
      { username },
      withRouterHeavyTimeout,
    ),
  disconnectExpired: (id: string) =>
    apiClient.post(
      `/routers/${id}/hotspot/active/disconnect-expired`,
      undefined,
      withRouterHeavyTimeout,
    ),
  migrateToRouter: (id: string, targetId: string, dryRun = false) =>
    apiClient.post(
      `/routers/${id}/migrate-to/${targetId}`,
      { dryRun },
      withRouterHeavyTimeout,
    ),
};
