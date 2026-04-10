import type {
  HotspotUserProfileRecord,
  RouterHotspotUserProfile,
} from "./router-api.types";
import { mapHotspotUserProfileRow } from "./router-api.utils";

export interface CreateHotspotUserProfileParams {
  name: string;
  rateLimit?: string;
  sharedUsers?: number;
  sessionTimeout?: string;
  idleTimeout?: string;
  keepaliveTimeout?: string;
  addressPool?: string;
}

export interface UpdateHotspotUserProfileParams {
  profileId: string;
  name?: string;
  rateLimit?: string;
  sharedUsers?: number;
  sessionTimeout?: string;
  idleTimeout?: string;
  keepaliveTimeout?: string;
  addressPool?: string;
}

function normalizeOptionalProfileField(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeSharedUsersValue(
  value: number | string | undefined,
): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : String(parsed);
}

export function mapAndSortHotspotUserProfiles(
  rows: HotspotUserProfileRecord[],
): RouterHotspotUserProfile[] {
  return rows
    .map((row) => mapHotspotUserProfileRow(row))
    .filter((row) => row.id.length > 0 && row.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildCreateHotspotUserProfileCommands(
  params: CreateHotspotUserProfileParams,
): string[] {
  const commands = [
    "/ip/hotspot/user/profile/add",
    `=name=${params.name.trim()}`,
  ];

  if (params.rateLimit !== undefined) {
    commands.push(`=rate-limit=${params.rateLimit.trim()}`);
  }
  if (params.sharedUsers !== undefined) {
    commands.push(`=shared-users=${params.sharedUsers}`);
  }
  if (params.sessionTimeout !== undefined) {
    commands.push(`=session-timeout=${params.sessionTimeout.trim()}`);
  }
  if (params.idleTimeout !== undefined) {
    commands.push(`=idle-timeout=${params.idleTimeout.trim()}`);
  }
  if (params.keepaliveTimeout !== undefined) {
    commands.push(`=keepalive-timeout=${params.keepaliveTimeout.trim()}`);
  }
  if (params.addressPool !== undefined) {
    commands.push(`=address-pool=${params.addressPool.trim()}`);
  }

  return commands;
}

export function buildUpdateHotspotUserProfileCommands(
  params: UpdateHotspotUserProfileParams,
  existing?: HotspotUserProfileRecord,
): { commands: string[]; hasUpdate: boolean } {
  const commands = ["/ip/hotspot/user/profile/set", `=.id=${params.profileId}`];

  if (params.name !== undefined) {
    const nextValue = params.name.trim();
    const currentValue = existing?.name?.trim() ?? "";
    if (nextValue && nextValue !== currentValue) {
      commands.push(`=name=${nextValue}`);
    }
  }
  if (params.rateLimit !== undefined) {
    const nextValue = normalizeOptionalProfileField(params.rateLimit);
    const currentValue = normalizeOptionalProfileField(
      existing?.["rate-limit"],
    );
    if (nextValue !== currentValue) {
      commands.push(`=rate-limit=${nextValue ?? ""}`);
    }
  }
  if (params.sharedUsers !== undefined) {
    const nextValue = normalizeSharedUsersValue(params.sharedUsers);
    const currentValue = normalizeSharedUsersValue(existing?.["shared-users"]);
    if (nextValue !== currentValue && nextValue !== null) {
      commands.push(`=shared-users=${nextValue}`);
    }
  }
  if (params.sessionTimeout !== undefined) {
    const nextValue = normalizeOptionalProfileField(params.sessionTimeout);
    const currentValue = normalizeOptionalProfileField(
      existing?.["session-timeout"],
    );
    if (nextValue !== currentValue) {
      commands.push(`=session-timeout=${nextValue ?? ""}`);
    }
  }
  if (params.idleTimeout !== undefined) {
    const nextValue = normalizeOptionalProfileField(params.idleTimeout);
    const currentValue = normalizeOptionalProfileField(
      existing?.["idle-timeout"],
    );
    if (nextValue !== currentValue) {
      commands.push(`=idle-timeout=${nextValue ?? ""}`);
    }
  }
  if (params.keepaliveTimeout !== undefined) {
    const nextValue = normalizeOptionalProfileField(params.keepaliveTimeout);
    const currentValue = normalizeOptionalProfileField(
      existing?.["keepalive-timeout"],
    );
    if (nextValue !== currentValue) {
      commands.push(`=keepalive-timeout=${nextValue ?? ""}`);
    }
  }
  if (params.addressPool !== undefined) {
    const nextValue = normalizeOptionalProfileField(params.addressPool);
    const currentValue = normalizeOptionalProfileField(
      existing?.["address-pool"],
    );
    if (nextValue !== currentValue) {
      commands.push(`=address-pool=${nextValue ?? ""}`);
    }
  }

  return { commands, hasUpdate: commands.length > 2 };
}

export function findCreatedHotspotUserProfile(
  refreshedRows: HotspotUserProfileRecord[],
  existingIds: Set<string>,
  profileName: string,
): HotspotUserProfileRecord | undefined {
  return (
    refreshedRows.find((row) => row[".id"] && !existingIds.has(row[".id"])) ??
    refreshedRows.find(
      (row) =>
        row.name?.trim().toLowerCase() === profileName.trim().toLowerCase(),
    )
  );
}
