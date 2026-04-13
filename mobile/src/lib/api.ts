import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
} from "axios";
import { deleteStoredValue, getStoredValue, setStoredValue } from "@/src/lib/storage";

const ACCESS_TOKEN_KEY = "mikroserver_access_token";
const REFRESH_TOKEN_KEY = "mikroserver_refresh_token";
const API_BASE_URL_KEY = "mikroserver_api_base_url";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  timestamp: string;
  requestId: string;
};

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type AuthTokens = TokenPair & {
  accessExpiresIn: number;
  refreshExpiresIn: number;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "SUPER_ADMIN" | "ADMIN" | "RESELLER" | "VIEWER";
  lastLoginAt: string | null;
};

export type DashboardKpis = {
  revenue: {
    today: number;
    thisMonth: number;
    last30Days: number;
    total: number;
  };
  transactions: {
    today: number;
    thisMonth: number;
    successRate: number;
    pending: number;
  };
  vouchers: {
    activeToday: number;
    deliveryFailures: number;
  };
  routers: {
    online: number;
    offline: number;
    total: number;
  };
  customers: {
    uniqueToday: number;
    uniqueThisMonth: number;
  };
};

export type RevenuePoint = {
  date: string;
  revenueXof: number;
  transactions: number;
};

export type Plan = {
  id: string;
  name: string;
  description?: string;
  slug: string;
  priceXof: number;
  durationMinutes: number;
  downloadKbps?: number;
  uploadKbps?: number;
  dataLimitMb?: number;
  userProfile?: string;
  displayOrder?: number;
  isPopular?: boolean;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
};

export type PlanPayload = {
  name: string;
  description?: string;
  durationMinutes: number;
  priceXof: number;
  downloadKbps?: number;
  uploadKbps?: number;
  dataLimitMb?: number;
  userProfile?: string;
  displayOrder?: number;
  isPopular?: boolean;
};

export type RouterStatus = "ONLINE" | "OFFLINE" | "DEGRADED" | "MAINTENANCE";

export type RouterItem = {
  id: string;
  name: string;
  description?: string;
  location?: string;
  wireguardIp: string | null;
  apiPort: number;
  apiUsername: string;
  hotspotProfile: string;
  hotspotServer: string;
  status: RouterStatus;
  lastSeenAt?: string;
  createdAt: string;
};

export type CreateRouterPayload = {
  name: string;
  description?: string;
  location?: string;
  wireguardIp: string;
  apiPort?: number;
  apiUsername: string;
  apiPassword: string;
  hotspotProfile?: string;
  hotspotServer?: string;
};

export type UpdateRouterPayload = {
  name?: string;
  description?: string;
  location?: string;
  hotspotProfile?: string;
  hotspotServer?: string;
  apiUsername?: string;
  apiPassword?: string;
};

export type LiveClient = {
  id: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
};

export type RouterLiveStats = {
  routerId: string;
  activeClients: number;
  totalBytesIn: number;
  totalBytesOut: number;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  clients: LiveClient[];
  fetchedAt: string;
};

export type SessionItem = {
  id: string;
  routerId: string;
  routerName: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  uptime: string;
  bytesIn: number;
  bytesOut: number;
};

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "RESELLER" | "VIEWER";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";

export type UserItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
};

export type CreateUserPayload = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: UserRole;
  phone?: string;
};

export type TransactionStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED";

export type TransactionItem = {
  id: string;
  reference: string;
  amountXof: number;
  status: TransactionStatus;
  externalReference?: string;
  customerPhone?: string;
  customerName?: string;
  createdAt: string;
  plan?: {
    name: string;
    slug: string;
  };
};

export type VoucherStatus =
  | "GENERATED"
  | "DELIVERED"
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKED"
  | "DELIVERY_FAILED";

export type VoucherItem = {
  id: string;
  code: string;
  status: VoucherStatus;
  planName?: string;
  generationType?: "AUTO" | "MANUAL";
  routerName?: string | null;
  lastDeliveryError?: string | null;
  deliveryAttempts?: number;
  expiresAt?: string;
  deliveredAt?: string;
  createdAt: string;
};

export type GeneratedVoucher = {
  id: string;
  code: string;
  passwordPlain: string;
  status: VoucherStatus;
  plan: {
    name: string;
    priceXof: number;
    durationMinutes: number;
  };
};

export type PagedResult<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export type VoucherPagedResult = {
  items: VoucherItem[];
  total: number;
  page: number;
  limit: number;
};

export type SettingEntry = {
  value: string;
  description: string;
  isSecret: boolean;
};

export type SettingsMap = Record<string, SettingEntry>;

const DEFAULT_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || "http://139.84.241.27:3001/proxy/api/v1";

let apiBaseUrl = normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
let accessToken: string | null = null;
let refreshToken: string | null = null;

type ApiEvents = {
  onUnauthorized?: () => void;
  onTokensChanged?: (tokens: TokenPair | null) => void;
};

const apiEvents: ApiEvents = {};
let refreshInFlight: Promise<AuthTokens | null> | null = null;

function looksLikeIpOrLocalhost(value: string): boolean {
  return /^(localhost|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?(?:\/|$)/i.test(value);
}

export function normalizeApiBaseUrl(input: string): string {
  const raw = input.trim();
  if (!raw) {
    return normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
  }

  const withProtocol = /^https?:\/\//i.test(raw)
    ? raw
    : looksLikeIpOrLocalhost(raw)
      ? `http://${raw}`
      : `https://${raw}`;

  const parsed = new URL(withProtocol);
  let pathname = parsed.pathname.replace(/\/+$/, "");

  if (!pathname || pathname === "") {
    pathname = "/proxy/api/v1";
  } else if (pathname === "/proxy") {
    pathname = "/proxy/api/v1";
  } else if (pathname === "/api") {
    pathname = "/api/v1";
  }

  parsed.pathname = pathname;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function isUnauthorized(error: unknown): error is AxiosError {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

async function persistTokens(tokens: TokenPair | null): Promise<void> {
  if (!tokens) {
    await deleteStoredValue(ACCESS_TOKEN_KEY);
    await deleteStoredValue(REFRESH_TOKEN_KEY);
    return;
  }

  await setStoredValue(ACCESS_TOKEN_KEY, tokens.accessToken);
  await setStoredValue(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function bootstrapApiState(): Promise<void> {
  const [storedBaseUrl, storedAccess, storedRefresh] = await Promise.all([
    getStoredValue(API_BASE_URL_KEY),
    getStoredValue(ACCESS_TOKEN_KEY),
    getStoredValue(REFRESH_TOKEN_KEY),
  ]);

  if (storedBaseUrl) {
    apiBaseUrl = normalizeApiBaseUrl(storedBaseUrl);
  }
  accessToken = storedAccess;
  refreshToken = storedRefresh;
}

export function setApiEventHandlers(handlers: ApiEvents): void {
  apiEvents.onUnauthorized = handlers.onUnauthorized;
  apiEvents.onTokensChanged = handlers.onTokensChanged;
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export async function setApiBaseUrl(nextBaseUrl: string): Promise<string> {
  const normalized = normalizeApiBaseUrl(nextBaseUrl);
  apiBaseUrl = normalized;
  await setStoredValue(API_BASE_URL_KEY, normalized);
  return normalized;
}

export function getAuthTokens(): TokenPair | null {
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

export async function setAuthTokens(tokens: TokenPair): Promise<void> {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  await persistTokens(tokens);
  apiEvents.onTokensChanged?.(tokens);
}

export async function clearAuthTokens(triggerUnauthorized = false): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await persistTokens(null);
  apiEvents.onTokensChanged?.(null);
  if (triggerUnauthorized) {
    apiEvents.onUnauthorized?.();
  }
}

function unwrapApi<T>(response: { data: ApiEnvelope<T> }): T {
  return response.data.data;
}

async function refreshTokens(): Promise<AuthTokens | null> {
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await axios.post<ApiEnvelope<AuthTokens>>(
      `${apiBaseUrl}/auth/refresh`,
      { refreshToken },
      {
        timeout: 15000,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    const nextTokens = unwrapApi(response);
    await setAuthTokens({
      accessToken: nextTokens.accessToken,
      refreshToken: nextTokens.refreshToken,
    });
    return nextTokens;
  } catch {
    await clearAuthTokens(true);
    return null;
  }
}

type RetryableRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
};

const apiClient: AxiosInstance = axios.create({
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = apiBaseUrl;

  if (!config.headers) {
    config.headers = new AxiosHeaders();
  }

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      refreshToken
    ) {
      originalRequest._retry = true;

      refreshInFlight ??= refreshTokens();
      const refreshed = await refreshInFlight;
      refreshInFlight = null;

      if (!refreshed) {
        return Promise.reject(error);
      }

      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;
      return apiClient(originalRequest);
    }

    if (error.response?.status === 401) {
      await clearAuthTokens(true);
    }

    return Promise.reject(error);
  },
);

export const api = {
  auth: {
    async login(email: string, password: string): Promise<{
      user: AuthenticatedUser;
      tokens: AuthTokens;
    }> {
      const response = await apiClient.post<
        ApiEnvelope<{
          user: AuthenticatedUser;
          tokens: AuthTokens;
        }>
      >("/auth/login", { email, password });
      return unwrapApi(response);
    },

    async logout(): Promise<void> {
      if (!refreshToken) {
        return;
      }
      await apiClient.post("/auth/logout", { refreshToken });
    },

    async me(): Promise<AuthenticatedUser> {
      const response = await apiClient.get<ApiEnvelope<AuthenticatedUser>>("/auth/me");
      return unwrapApi(response);
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
      await apiClient.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
    },

    async updateProfile(data: { firstName?: string; lastName?: string; phone?: string }): Promise<AuthenticatedUser> {
      const response = await apiClient.patch<ApiEnvelope<AuthenticatedUser>>("/auth/me", data);
      return unwrapApi(response);
    },
  },

  metrics: {
    async dashboard(): Promise<DashboardKpis> {
      const response = await apiClient.get<ApiEnvelope<DashboardKpis>>("/metrics/dashboard");
      return unwrapApi(response);
    },

    async revenueChart(days = 30): Promise<RevenuePoint[]> {
      const response = await apiClient.get<ApiEnvelope<RevenuePoint[]>>(
        `/metrics/revenue-chart?days=${days}`,
      );
      return unwrapApi(response);
    },
  },

  plans: {
    async list(includeArchived = false): Promise<Plan[]> {
      const response = await apiClient.get<ApiEnvelope<Plan[]>>(
        `/plans?includeArchived=${includeArchived}`,
      );
      return unwrapApi(response);
    },

    async create(payload: PlanPayload): Promise<Plan> {
      const response = await apiClient.post<ApiEnvelope<Plan>>("/plans", payload);
      return unwrapApi(response);
    },

    async update(id: string, payload: Partial<PlanPayload>): Promise<Plan> {
      const response = await apiClient.patch<ApiEnvelope<Plan>>(`/plans/${id}`, payload);
      return unwrapApi(response);
    },

    async archive(id: string): Promise<Plan> {
      const response = await apiClient.delete<ApiEnvelope<Plan>>(`/plans/${id}`);
      return unwrapApi(response);
    },
  },

  users: {
    async list(role?: UserRole): Promise<UserItem[]> {
      const query = role ? `?role=${role}` : "";
      const response = await apiClient.get<ApiEnvelope<UserItem[]>>(`/users${query}`);
      return unwrapApi(response);
    },

    async resellers(): Promise<UserItem[]> {
      const response = await apiClient.get<ApiEnvelope<UserItem[]>>("/users/resellers");
      return unwrapApi(response);
    },

    async create(payload: CreateUserPayload): Promise<UserItem> {
      const response = await apiClient.post<ApiEnvelope<UserItem>>("/users", payload);
      return unwrapApi(response);
    },

    async suspend(id: string): Promise<UserItem> {
      const response = await apiClient.post<ApiEnvelope<UserItem>>(`/users/${id}/suspend`);
      return unwrapApi(response);
    },

    async activate(id: string): Promise<UserItem> {
      const response = await apiClient.post<ApiEnvelope<UserItem>>(`/users/${id}/activate`);
      return unwrapApi(response);
    },

    async remove(id: string): Promise<{ success: boolean }> {
      const response = await apiClient.delete<ApiEnvelope<{ success: boolean }>>(
        `/users/${id}`,
      );
      return unwrapApi(response);
    },
  },

  routers: {
    async list(): Promise<RouterItem[]> {
      const response = await apiClient.get<ApiEnvelope<RouterItem[]>>("/routers");
      return unwrapApi(response);
    },

    async get(id: string): Promise<RouterItem> {
      const response = await apiClient.get<ApiEnvelope<RouterItem>>(`/routers/${id}`);
      return unwrapApi(response);
    },

    async create(payload: CreateRouterPayload): Promise<RouterItem> {
      const response = await apiClient.post<ApiEnvelope<RouterItem>>("/routers", payload);
      return unwrapApi(response);
    },

    async update(id: string, payload: UpdateRouterPayload): Promise<RouterItem> {
      const response = await apiClient.patch<ApiEnvelope<RouterItem>>(
        `/routers/${id}`,
        payload,
      );
      return unwrapApi(response);
    },

    async remove(id: string): Promise<{ success: boolean }> {
      const response = await apiClient.delete<ApiEnvelope<{ success: boolean }>>(
        `/routers/${id}`,
      );
      return unwrapApi(response);
    },

    async bootstrap(id: string): Promise<{
      routerId: string; routerName: string; wgIp: string | null;
      privateKey: string | null; publicKey: string | null;
      vpsPublicKey: string | null; endpoint: string | null;
      listenPort: number; tunnelReady: boolean; mikrotikCmd: string | null;
      provisionedAt: string | null;
    }> {
      const response = await apiClient.get<ApiEnvelope<{
        routerId: string; routerName: string; wgIp: string | null;
        privateKey: string | null; publicKey: string | null;
        vpsPublicKey: string | null; endpoint: string | null;
        listenPort: number; tunnelReady: boolean; mikrotikCmd: string | null;
        provisionedAt: string | null;
      }>>(`/routers/${id}/bootstrap`);
      return unwrapApi(response);
    },

    async healthCheck(id: string): Promise<{ success: boolean }> {
      const response = await apiClient.post<ApiEnvelope<{ success: boolean }>>(
        `/routers/${id}/health-check`,
      );
      return unwrapApi(response);
    },

    async liveStats(id: string): Promise<RouterLiveStats> {
      const response = await apiClient.get<ApiEnvelope<RouterLiveStats>>(
        `/routers/${id}/live-stats`,
      );
      return unwrapApi(response);
    },

    async wireguardConfig(id: string): Promise<{ config: string; routerName: string; wireguardIp: string }> {
      const response = await apiClient.get<ApiEnvelope<{ config: string; routerName: string; wireguardIp: string }>>(
        `/routers/${id}/wireguard-config`,
      );
      return unwrapApi(response);
    },
  },

  sessions: {
    async active(routerId?: string): Promise<SessionItem[]> {
      const query = routerId ? `?routerId=${routerId}` : "";
      const response = await apiClient.get<ApiEnvelope<SessionItem[]>>(
        `/sessions/active${query}`,
      );
      return unwrapApi(response);
    },

    async terminate(routerId: string, mikrotikId: string): Promise<{ success: boolean }> {
      const response = await apiClient.post<ApiEnvelope<{ success: boolean }>>(
        "/sessions/terminate",
        { routerId, mikrotikId },
      );
      return unwrapApi(response);
    },
  },

  transactions: {
    async list(page = 1, limit = 20): Promise<PagedResult<TransactionItem>> {
      const response = await apiClient.get<ApiEnvelope<PagedResult<TransactionItem>>>(
        `/transactions?page=${page}&limit=${limit}`,
      );
      return unwrapApi(response);
    },

    async get(id: string): Promise<TransactionItem> {
      const response = await apiClient.get<ApiEnvelope<TransactionItem>>(
        `/transactions/${id}`,
      );
      return unwrapApi(response);
    },
  },

  vouchers: {
    async list(page = 1, limit = 20): Promise<VoucherPagedResult> {
      const response = await apiClient.get<ApiEnvelope<VoucherPagedResult>>(
        `/vouchers?page=${page}&limit=${limit}`,
      );
      return unwrapApi(response);
    },

    async revoke(id: string): Promise<{ success: boolean }> {
      const response = await apiClient.post<ApiEnvelope<{ success: boolean }>>(
        `/vouchers/${id}/revoke`,
      );
      return unwrapApi(response);
    },

    async redeliver(id: string): Promise<{ success: boolean }> {
      const response = await apiClient.post<ApiEnvelope<{ success: boolean }>>(
        `/vouchers/${id}/redeliver`,
      );
      return unwrapApi(response);
    },

    async generateBulk(payload: {
      planId: string;
      routerId: string;
      count: number;
    }): Promise<GeneratedVoucher[]> {
      const response = await apiClient.post<ApiEnvelope<GeneratedVoucher[]>>(
        "/vouchers/generate/bulk",
        payload,
      );
      return unwrapApi(response);
    },

    async downloadPdf(
      voucherIds: string[],
      businessName?: string,
    ): Promise<ArrayBuffer> {
      const response = await apiClient.post<ArrayBuffer>(
        "/vouchers/pdf",
        { voucherIds, businessName },
        { responseType: "arraybuffer" },
      );
      return response.data;
    },
  },

  settings: {
    async get(): Promise<SettingsMap> {
      const response = await apiClient.get<ApiEnvelope<SettingsMap>>("/settings");
      return unwrapApi(response);
    },

    async update(payload: Record<string, string>): Promise<SettingsMap> {
      const response = await apiClient.patch<ApiEnvelope<SettingsMap>>(
        "/settings",
        payload,
      );
      return unwrapApi(response);
    },
  },
};

export function extractErrorMessage(error: unknown): string {
  if (isUnauthorized(error)) {
    return "Session expirée. Merci de vous reconnecter.";
  }

  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as
      | { message?: string | string[] }
      | undefined;
    const message = responseData?.message;
    if (Array.isArray(message)) {
      return message.join("\n");
    }
    if (typeof message === "string") {
      return message;
    }
    if (typeof error.message === "string" && error.message.length > 0) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Une erreur est survenue.";
}

