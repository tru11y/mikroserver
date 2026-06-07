import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { RouterFormState, RouterItem, RouterStatus } from './routers.types';

export const STATUS_OPTIONS: Array<{ value: 'ALL' | RouterStatus; label: string }> = [
  { value: 'ALL', label: 'Tous les statuts' },
  { value: 'ONLINE', label: 'En ligne' },
  { value: 'DEGRADED', label: 'Degrade' },
  { value: 'OFFLINE', label: 'Hors ligne' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
];

export const EMPTY_FORM: RouterFormState = {
  name: '',
  description: '',
  location: '',
  site: '',
  tags: '',
  wireguardIp: '',
  apiPort: '8728',
  apiUsername: '',
  apiPassword: '',
  hotspotProfile: 'default',
  hotspotServer: 'hotspot1',
  ownerId: '',
};

export function formatRelative(value?: string | null): string {
  if (!value) return 'Jamais';
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale: fr });
  } catch {
    return 'Jamais';
  }
}

export const STATUS_PRIORITY: Record<RouterStatus, number> = {
  OFFLINE:     0,
  DEGRADED:    1,
  MAINTENANCE: 2,
  ONLINE:      3,
};

export const STATUS_LABELS: Record<RouterStatus, string> = {
  ONLINE:      'En ligne',
  DEGRADED:    'Dégradé',
  OFFLINE:     'Hors ligne',
  MAINTENANCE: 'Maintenance',
};

export function getStatusLabel(status: RouterStatus): string {
  return STATUS_LABELS[status];
}

// Token-based classes — no hardcoded colors
export const STATUS_CLASSES: Record<RouterStatus, string> = {
  ONLINE:      'border-success/30 bg-success/10 text-success',
  DEGRADED:    'border-warning/30 bg-warning/10 text-warning',
  OFFLINE:     'border-destructive/30 bg-destructive/10 text-destructive',
  MAINTENANCE: 'border-info/30 bg-info/10 text-info',
};

export function getStatusClasses(status: RouterStatus): string {
  return STATUS_CLASSES[status];
}

export const STATUS_DOT_CLASSES: Record<RouterStatus, string> = {
  ONLINE:      'bg-success',
  DEGRADED:    'bg-warning',
  OFFLINE:     'bg-destructive',
  MAINTENANCE: 'bg-info',
};

export function getStatusDotClass(status: RouterStatus): string {
  return STATUS_DOT_CLASSES[status];
}

export function parseTags(tagsInput: string): string[] {
  return Array.from(
    new Set(
      tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12),
    ),
  );
}

export function toFormState(router?: RouterItem | null): RouterFormState {
  if (!router) {
    return EMPTY_FORM;
  }

  return {
    name: router.name,
    description: router.description ?? '',
    location: router.location ?? '',
    site: router.site ?? '',
    tags: router.tags.join(', '),
    wireguardIp: router.wireguardIp ?? '',
    apiPort: String(router.apiPort ?? 8728),
    apiUsername: router.apiUsername,
    apiPassword: '',
    hotspotProfile: router.hotspotProfile ?? 'default',
    hotspotServer: router.hotspotServer ?? 'hotspot1',
    ownerId: '',
  };
}

export function getQueryErrorMessage(error: unknown, fallback: string): string {
  const responseMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data
    ?.message;

  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage;
  }

  if (Array.isArray(responseMessage) && responseMessage.length > 0) {
    return responseMessage.join(', ');
  }

  const nativeMessage = (error as { message?: unknown })?.message;
  if (typeof nativeMessage === 'string' && nativeMessage.trim()) {
    return nativeMessage;
  }

  return fallback;
}
