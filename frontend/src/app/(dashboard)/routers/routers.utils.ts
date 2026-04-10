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
  if (!value) {
    return 'Jamais';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function getStatusLabel(status: RouterStatus) {
  if (status === 'ONLINE') {
    return 'En ligne';
  }
  if (status === 'DEGRADED') {
    return 'Degrade';
  }
  if (status === 'MAINTENANCE') {
    return 'Maintenance';
  }
  return 'Hors ligne';
}

export function getStatusClasses(status: RouterStatus) {
  if (status === 'ONLINE') {
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  }
  if (status === 'DEGRADED') {
    return 'border-orange-400/30 bg-orange-400/10 text-orange-100';
  }
  if (status === 'MAINTENANCE') {
    return 'border-amber-400/30 bg-amber-400/10 text-amber-100';
  }
  return 'border-red-400/30 bg-red-400/10 text-red-200';
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
