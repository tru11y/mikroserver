import type {
  HotspotActiveClient,
  HotspotHostRecord,
  HotspotIpBindingRecord,
  HotspotIpBindingType,
  RouterHotspotIpBinding,
} from "./router-api.types";
import {
  isRouterBooleanTrue,
  mapIpBindingRow,
  normalizeLookupKey,
} from "./router-api.utils";

export interface HotspotIpBindingsSnapshot {
  ipBindings: HotspotIpBindingRecord[];
  hosts: HotspotHostRecord[];
  active: HotspotActiveClient[];
}

export interface CreateHotspotIpBindingParams {
  server?: string;
  address?: string;
  macAddress?: string;
  type?: HotspotIpBindingType;
  comment?: string;
  toAddress?: string;
  addressList?: string;
  disabled?: boolean;
}

export interface UpdateHotspotIpBindingParams {
  bindingId: string;
  server?: string | null;
  address?: string | null;
  macAddress?: string | null;
  type?: HotspotIpBindingType;
  comment?: string | null;
  toAddress?: string | null;
  addressList?: string | null;
  disabled?: boolean;
}

function normalizeOptionalBindingField(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveHotspotIpBindings(
  snapshot: HotspotIpBindingsSnapshot,
  hotspotServer: string | null,
): RouterHotspotIpBinding[] {
  const activeByAddress = new Map<string, string>();
  const activeByMac = new Map<string, string>();

  for (const activeRow of snapshot.active) {
    const user = activeRow.user?.trim();
    if (!user) {
      continue;
    }

    const addressKey = normalizeLookupKey(activeRow.address);
    const macKey = normalizeLookupKey(activeRow["mac-address"]);

    if (addressKey && !activeByAddress.has(addressKey)) {
      activeByAddress.set(addressKey, user);
    }
    if (macKey && !activeByMac.has(macKey)) {
      activeByMac.set(macKey, user);
    }
  }

  const hostByAddress = new Map<
    string,
    { user: string | null; hostName: string | null }
  >();
  const hostByMac = new Map<
    string,
    { user: string | null; hostName: string | null }
  >();

  for (const hostRow of snapshot.hosts) {
    if (
      hotspotServer &&
      hostRow.server?.trim() &&
      hostRow.server.trim() !== hotspotServer
    ) {
      continue;
    }

    const user = hostRow.user?.trim() || null;
    const hostName = hostRow["host-name"]?.trim() || null;
    const info = { user, hostName };
    const addressKey = normalizeLookupKey(hostRow.address);
    const macKey = normalizeLookupKey(hostRow["mac-address"]);

    if (addressKey && !hostByAddress.has(addressKey)) {
      hostByAddress.set(addressKey, info);
    }
    if (macKey && !hostByMac.has(macKey)) {
      hostByMac.set(macKey, info);
    }
  }

  return snapshot.ipBindings
    .map((row) => {
      const addressKey = normalizeLookupKey(row.address);
      const macKey = normalizeLookupKey(row["mac-address"]);
      const activeUser =
        (addressKey ? activeByAddress.get(addressKey) : undefined) ??
        (macKey ? activeByMac.get(macKey) : undefined) ??
        null;
      const hostInfo =
        (addressKey ? hostByAddress.get(addressKey) : undefined) ??
        (macKey ? hostByMac.get(macKey) : undefined) ??
        null;

      return mapIpBindingRow(row, {
        resolvedUser: activeUser ?? hostInfo?.user ?? null,
        hostName: hostInfo?.hostName ?? null,
      });
    })
    .filter((row) => row.id.length > 0)
    .sort((a, b) => {
      if (a.disabled !== b.disabled) {
        return a.disabled ? 1 : -1;
      }

      return (a.address ?? "").localeCompare(b.address ?? "");
    });
}

export function buildCreateHotspotIpBindingCommands(
  params: CreateHotspotIpBindingParams,
): string[] {
  const commands = ["/ip/hotspot/ip-binding/add"];

  if (params.server?.trim()) {
    commands.push(`=server=${params.server.trim()}`);
  }
  if (params.address?.trim()) {
    commands.push(`=address=${params.address.trim()}`);
  }
  if (params.macAddress?.trim()) {
    commands.push(`=mac-address=${params.macAddress.trim()}`);
  }
  if (params.type) {
    commands.push(`=type=${params.type}`);
  }
  if (params.comment !== undefined) {
    commands.push(`=comment=${params.comment.trim()}`);
  }
  if (params.toAddress !== undefined) {
    commands.push(`=to-address=${params.toAddress.trim()}`);
  }
  if (params.addressList !== undefined) {
    commands.push(`=address-list=${params.addressList.trim()}`);
  }
  if (params.disabled !== undefined) {
    commands.push(`=disabled=${params.disabled ? "yes" : "no"}`);
  }

  return commands;
}

export function buildUpdateHotspotIpBindingCommands(
  params: UpdateHotspotIpBindingParams,
  existing?: HotspotIpBindingRecord,
): string[] {
  const commands = ["/ip/hotspot/ip-binding/set", `=.id=${params.bindingId}`];

  if (params.server !== undefined) {
    const nextValue = normalizeOptionalBindingField(params.server);
    const currentValue = normalizeOptionalBindingField(existing?.server);
    if (nextValue !== currentValue) {
      commands.push(`=server=${nextValue ?? ""}`);
    }
  }
  if (params.address !== undefined) {
    const nextValue = normalizeOptionalBindingField(params.address);
    const currentValue = normalizeOptionalBindingField(existing?.address);
    if (nextValue !== currentValue) {
      commands.push(`=address=${nextValue ?? ""}`);
    }
  }
  if (params.macAddress !== undefined) {
    const nextValue = normalizeOptionalBindingField(params.macAddress);
    const currentValue = normalizeOptionalBindingField(
      existing?.["mac-address"],
    );
    if (nextValue !== currentValue) {
      commands.push(`=mac-address=${nextValue ?? ""}`);
    }
  }
  if (params.type !== undefined) {
    const currentValue = normalizeOptionalBindingField(existing?.type);
    if (params.type !== currentValue) {
      commands.push(`=type=${params.type}`);
    }
  }
  if (params.comment !== undefined) {
    const nextValue = params.comment?.trim() ?? "";
    const currentValue = existing?.comment?.trim() ?? "";
    if (nextValue !== currentValue) {
      commands.push(`=comment=${nextValue}`);
    }
  }
  if (params.toAddress !== undefined) {
    const nextValue = normalizeOptionalBindingField(params.toAddress);
    const currentValue = normalizeOptionalBindingField(
      existing?.["to-address"],
    );
    if (nextValue !== currentValue) {
      commands.push(`=to-address=${nextValue ?? ""}`);
    }
  }
  if (params.addressList !== undefined) {
    const nextValue = normalizeOptionalBindingField(params.addressList);
    const currentValue = normalizeOptionalBindingField(
      existing?.["address-list"],
    );
    if (nextValue !== currentValue) {
      commands.push(`=address-list=${nextValue ?? ""}`);
    }
  }
  if (params.disabled !== undefined) {
    const currentValue = existing
      ? String(isRouterBooleanTrue(existing.disabled))
      : null;
    const nextValue = String(params.disabled);
    if (nextValue !== currentValue) {
      commands.push(`=disabled=${params.disabled ? "yes" : "no"}`);
    }
  }

  return commands;
}

export function findCreatedHotspotIpBinding(
  refreshedRows: HotspotIpBindingRecord[],
  existingIds: Set<string>,
  params: CreateHotspotIpBindingParams,
): HotspotIpBindingRecord | undefined {
  return (
    refreshedRows.find((row) => row[".id"] && !existingIds.has(row[".id"])) ??
    refreshedRows.find(
      (row) =>
        (params.address
          ? row.address?.trim() === params.address.trim()
          : true) &&
        (params.macAddress
          ? row["mac-address"]?.trim() === params.macAddress.trim()
          : true),
    )
  );
}
