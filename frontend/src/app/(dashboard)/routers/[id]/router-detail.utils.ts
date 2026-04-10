import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { IpBindingType } from './router-detail.types';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatBps(bps: number): string {
  if (bps === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  return `${parseFloat((bps / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

export function formatElapsedFromMinutes(minutes?: number | null): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return '-';
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return `${hours}h ${remainingMinutes}min`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}j ${remainingHours}h`;
}

export function formatRelative(date?: string | null): string {
  if (!date) return 'Jamais';
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
}

export function normalizeProfileName(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function normalizeIpBindingType(value?: string | null): IpBindingType {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'blocked' || normalized === 'bypassed') {
    return normalized;
  }
  return 'regular';
}

export function parseOptionalPositiveInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export function parseRouterUptimeToSeconds(value?: string | null): number {
  const input = (value ?? '').trim().toLowerCase();
  if (!input) {
    return 0;
  }

  let totalSeconds = 0;
  let matchedDurationToken = false;
  const durationRegex = /(\d+)\s*([wdhms])/g;
  let match: RegExpExecArray | null;

  while ((match = durationRegex.exec(input)) !== null) {
    matchedDurationToken = true;
    const amount = Number.parseInt(match[1] ?? '0', 10);
    const unit = match[2];

    if (Number.isNaN(amount)) {
      continue;
    }

    if (unit === 'w') {
      totalSeconds += amount * 7 * 24 * 60 * 60;
    } else if (unit === 'd') {
      totalSeconds += amount * 24 * 60 * 60;
    } else if (unit === 'h') {
      totalSeconds += amount * 60 * 60;
    } else if (unit === 'm') {
      totalSeconds += amount * 60;
    } else if (unit === 's') {
      totalSeconds += amount;
    }
  }

  const colonPart = input.replace(durationRegex, '').trim();
  if (colonPart.includes(':')) {
    const parts = colonPart
      .split(':')
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((part) => !Number.isNaN(part));

    if (parts.length === 4) {
      totalSeconds +=
        parts[0]! * 24 * 60 * 60 +
        parts[1]! * 60 * 60 +
        parts[2]! * 60 +
        parts[3]!;
      return totalSeconds;
    }

    if (parts.length === 3) {
      totalSeconds += parts[0]! * 60 * 60 + parts[1]! * 60 + parts[2]!;
      return totalSeconds;
    }

    if (parts.length === 2) {
      totalSeconds += parts[0]! * 60 + parts[1]!;
      return totalSeconds;
    }
  }

  if (matchedDurationToken) {
    return totalSeconds;
  }

  const asNumber = Number.parseInt(input, 10);
  return Number.isNaN(asNumber) ? 0 : asNumber;
}
