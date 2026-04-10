import {
  HotspotIpBindingRecord,
  HotspotUserProfileRecord,
  RouterHotspotIpBinding,
  RouterHotspotUserProfile,
} from "./router-api.types";

export function isRouterBooleanTrue(
  value: string | boolean | undefined,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return ["true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

export function mapHotspotUserProfileRow(
  row: HotspotUserProfileRecord,
): RouterHotspotUserProfile {
  const sharedUsersValue = row["shared-users"];
  const parsedSharedUsers =
    sharedUsersValue && !Number.isNaN(Number.parseInt(sharedUsersValue, 10))
      ? Number.parseInt(sharedUsersValue, 10)
      : null;

  return {
    id: row[".id"] ?? "",
    name: row.name?.trim() ?? "",
    rateLimit: row["rate-limit"]?.trim() || null,
    sharedUsers: parsedSharedUsers,
    sessionTimeout: row["session-timeout"]?.trim() || null,
    idleTimeout: row["idle-timeout"]?.trim() || null,
    keepaliveTimeout: row["keepalive-timeout"]?.trim() || null,
    addressPool: row["address-pool"]?.trim() || null,
  };
}

export function mapIpBindingRow(
  row: HotspotIpBindingRecord,
  context?: {
    resolvedUser?: string | null;
    hostName?: string | null;
  },
): RouterHotspotIpBinding {
  return {
    id: row[".id"] ?? "",
    server: row.server?.trim() || null,
    address: row.address?.trim() || null,
    macAddress: row["mac-address"]?.trim() || null,
    type: row.type?.trim() || null,
    comment: row.comment?.trim() || null,
    disabled: isRouterBooleanTrue(row.disabled),
    toAddress: row["to-address"]?.trim() || null,
    addressList: row["address-list"]?.trim() || null,
    resolvedUser: context?.resolvedUser?.trim() || null,
    hostName: context?.hostName?.trim() || null,
  };
}

export function normalizeLookupKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function compareLegacyPassword(
  routerPassword: string | undefined,
  passwordCandidates: string[],
): boolean | null {
  if (!routerPassword?.trim()) {
    return null;
  }

  const expected = routerPassword.trim();
  return passwordCandidates.some((candidate) => candidate.trim() === expected);
}

export function deriveActivatedAt(uptime: string | undefined): Date | null {
  const uptimeSeconds = parseRouterDurationSeconds(uptime);
  if (uptimeSeconds <= 0) {
    return null;
  }

  return new Date(Date.now() - uptimeSeconds * 1000);
}

export function parseRouterDurationMinutes(value: string | undefined): number {
  const totalSeconds = parseRouterDurationSeconds(value);
  if (totalSeconds <= 0) {
    return 0;
  }

  return Math.max(1, Math.round(totalSeconds / 60));
}

export function parseRouterDurationSeconds(value: string | undefined): number {
  const raw = value?.trim();
  if (!raw) {
    return 0;
  }

  const normalized = raw.replace(/\s+/g, "");
  let totalSeconds = 0;
  let matched = false;

  const clockMatch = normalized.match(/^(.*?)(\d{1,3}):(\d{2}):(\d{2})$/);
  let tokenPart = normalized;

  if (clockMatch) {
    tokenPart = clockMatch[1] ?? "";
    totalSeconds +=
      parseInt(clockMatch[2] ?? "0", 10) * 3600 +
      parseInt(clockMatch[3] ?? "0", 10) * 60 +
      parseInt(clockMatch[4] ?? "0", 10);
    matched = true;
  }

  const tokenRegex = /(\d+)(w|d|h|m|s)/gi;
  for (const part of tokenPart.matchAll(tokenRegex)) {
    const amount = parseInt(part[1] ?? "0", 10);
    const unit = (part[2] ?? "").toLowerCase();
    matched = true;

    switch (unit) {
      case "w":
        totalSeconds += amount * 7 * 24 * 3600;
        break;
      case "d":
        totalSeconds += amount * 24 * 3600;
        break;
      case "h":
        totalSeconds += amount * 3600;
        break;
      case "m":
        totalSeconds += amount * 60;
        break;
      case "s":
        totalSeconds += amount;
        break;
      default:
        break;
    }
  }

  if (matched) {
    return totalSeconds;
  }

  return /^\d+$/.test(normalized) ? parseInt(normalized, 10) * 60 : 0;
}
