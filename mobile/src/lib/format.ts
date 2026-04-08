export function formatXof(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(value ?? 0);
}

export function formatShortDate(value?: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("fr-FR");
}

export function formatBytes(bytes: number): string {
  if (!bytes) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatBps(bytesPerSecond: number): string {
  if (!bytesPerSecond) {
    return "0 B/s";
  }
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  if (minutes < 1440) {
    return `${Math.round(minutes / 60)} h`;
  }
  return `${Math.round(minutes / 1440)} j`;
}

