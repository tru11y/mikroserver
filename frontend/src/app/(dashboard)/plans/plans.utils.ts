import type { Plan, PlanFormData } from './plans.types';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parse RouterOS/WinBox-style duration string into minutes. */
export function parseDurationInput(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  const dayMatch = s.match(/^(\d+)d(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/i);
  if (dayMatch) {
    const d = parseInt(dayMatch[1], 10);
    const h = parseInt(dayMatch[2] ?? '0', 10);
    const m = parseInt(dayMatch[3] ?? '0', 10);
    return d * 24 * 60 + h * 60 + m;
  }

  const hourMatch = s.match(/^(\d+)h(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/i);
  if (hourMatch) {
    const h = parseInt(hourMatch[1], 10);
    const m = parseInt(hourMatch[2] ?? '0', 10);
    return h * 60 + m;
  }

  const timeMatch = s.match(/^(\d+):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    return h * 60 + m;
  }

  return null;
}

/** Format minutes to WinBox display: "7h 00:00", "3d 00:00", "0:30:00" */
export function formatDurationDisplay(minutes: number): string {
  if (minutes < 60) return `0:${pad2(minutes)}:00`;
  const totalHours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (totalHours < 24) return `${totalHours}h ${pad2(mins)}:00`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}d ${pad2(hours)}:${pad2(mins)}:00`;
}

/** Human-readable duration for display in cards. */
export function formatDuration(minutes: number): string {
  const hours = minutes / 60;
  if (hours < 24) {
    return `${Number(hours.toFixed(hours % 1 === 0 ? 0 : 1))} h`;
  }
  const days = hours / 24;
  if (days % 1 === 0) return `${days} j`;
  return `${Number(days.toFixed(1))} j`;
}

export function formatSpeed(kbps?: number | null): string {
  if (!kbps) return 'Illimité';
  return `${Number((kbps / 1024).toFixed(kbps % 1024 === 0 ? 0 : 1))} Mbps`;
}

export function formatDataLimit(mb?: number | null): string {
  if (!mb) return 'Illimité';
  if (mb >= 1024) return `${Number((mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1))} Go`;
  return `${mb} Mo`;
}

export function kbpsToMbps(kbps: number): number {
  if (!kbps) return 0;
  return Number((kbps / 1024).toFixed(kbps % 1024 === 0 ? 0 : 2));
}

export function mbpsToKbps(mbps: number): number {
  if (!mbps) return 0;
  return Math.max(64, Math.round(mbps * 1024));
}

export function buildDefaultForm(): PlanFormData {
  return {
    name: '',
    description: '',
    priceXof: 500,
    durationMinutes: 60,
    downloadKbps: 2048,
    uploadKbps: 1024,
    dataLimitMb: 0,
    userProfile: 'default',
    displayOrder: 0,
    isPopular: false,
    ticketType: 'PIN',
    durationMode: 'ELAPSED',
    ticketPrefix: 'MS',
    ticketCodeLength: 8,
    ticketNumericOnly: false,
    ticketPasswordLength: 8,
    ticketPasswordNumericOnly: false,
    usersPerTicket: 1,
  };
}

export function normalizePlanPayload(form: PlanFormData) {
  return {
    name: form.name,
    description: form.description || undefined,
    priceXof: form.priceXof,
    durationMinutes: form.durationMinutes,
    downloadKbps: form.downloadKbps > 0 ? form.downloadKbps : null,
    uploadKbps: form.uploadKbps > 0 ? form.uploadKbps : null,
    dataLimitMb: form.dataLimitMb > 0 ? form.dataLimitMb : null,
    userProfile: form.userProfile || undefined,
    displayOrder: form.displayOrder,
    isPopular: form.isPopular,
    ticketType: form.ticketType,
    durationMode: form.durationMode,
    ticketPrefix: form.ticketPrefix || undefined,
    ticketCodeLength: form.ticketCodeLength,
    ticketNumericOnly: form.ticketNumericOnly,
    ticketPasswordLength: form.ticketPasswordLength,
    ticketPasswordNumericOnly: form.ticketPasswordNumericOnly,
    usersPerTicket: form.usersPerTicket,
  };
}

export function planFormFromPlan(plan: Plan): PlanFormData {
  return {
    name: plan.name,
    description: plan.description ?? '',
    priceXof: plan.priceXof,
    durationMinutes: plan.durationMinutes,
    downloadKbps: plan.downloadKbps ?? 0,
    uploadKbps: plan.uploadKbps ?? 0,
    dataLimitMb: plan.dataLimitMb ?? 0,
    userProfile: plan.userProfile ?? 'default',
    displayOrder: plan.displayOrder ?? 0,
    isPopular: Boolean(plan.isPopular),
    ticketType: plan.ticketSettings.ticketType,
    durationMode: plan.ticketSettings.durationMode,
    ticketPrefix: plan.ticketSettings.ticketPrefix,
    ticketCodeLength: plan.ticketSettings.ticketCodeLength,
    ticketNumericOnly: plan.ticketSettings.ticketNumericOnly,
    ticketPasswordLength: plan.ticketSettings.ticketPasswordLength,
    ticketPasswordNumericOnly: plan.ticketSettings.ticketPasswordNumericOnly,
    usersPerTicket: plan.ticketSettings.usersPerTicket,
  };
}

export function formatPrice(xof: number): string {
  return new Intl.NumberFormat('fr-CI', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(xof);
}
