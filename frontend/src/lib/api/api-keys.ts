import { apiClient } from './client';

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreatedApiKey extends ApiKeyItem {
  rawKey: string;
}

export interface CreateApiKeyPayload {
  name: string;
  permissions: string[];
  expiresAt?: string;
}

export const apiKeysApi = {
  list: () => apiClient.get<{ data: ApiKeyItem[] }>('/api-keys'),
  create: (payload: CreateApiKeyPayload) =>
    apiClient.post<{ data: CreatedApiKey }>('/api-keys', payload),
  revoke: (id: string) => apiClient.delete(`/api-keys/${id}`),
};
