import type {
  HotspotActiveClient,
  HotspotUserRecord,
  RouterHotspotUser,
} from "./router-api.types";
import { isRouterBooleanTrue } from "./router-api.utils";

export interface HotspotVoucherSnapshot {
  code: string;
  status: string;
  activatedAt: Date | null;
  expiresAt: Date | null;
  session: {
    startedAt: Date | null;
  } | null;
  plan: {
    name: string;
    durationMinutes: number;
  } | null;
}

export function mapRouterHotspotUsers(
  userRows: HotspotUserRecord[],
  activeRows: HotspotActiveClient[],
): RouterHotspotUser[] {
  const activeByUsername = new Map<string, HotspotActiveClient[]>();
  for (const activeRow of activeRows) {
    const username = activeRow.user?.trim();
    if (!username) {
      continue;
    }

    const bucket = activeByUsername.get(username) ?? [];
    bucket.push(activeRow);
    activeByUsername.set(username, bucket);
  }

  return userRows
    .map((row) => {
      const username = row.name?.trim() ?? "";
      const sessions = activeByUsername.get(username) ?? [];
      const firstSession = sessions[0];

      return {
        id: row[".id"] ?? "",
        username,
        profile: row.profile?.trim() || null,
        comment: row.comment?.trim() || null,
        disabled: isRouterBooleanTrue(row.disabled),
        active: sessions.length > 0,
        activeSessionCount: sessions.length,
        activeAddress: firstSession?.address ?? null,
        activeMacAddress: firstSession?.["mac-address"] ?? null,
        uptime: row.uptime?.trim() || null,
        limitUptime: row["limit-uptime"]?.trim() || null,
        managedByMikroServer: false,
        planName: null,
        planDurationMinutes: null,
        voucherStatus: null,
        firstConnectionAt: null,
        elapsedSinceFirstConnectionMinutes: null,
        voucherExpiresAt: null,
        remainingMinutes: null,
        isTariffExpired: null,
        enforcementStatus: "UNMANAGED",
      } satisfies RouterHotspotUser;
    })
    .filter((row) => row.id.length > 0 && row.username.length > 0);
}

export function enrichRouterHotspotUsersWithVouchers(
  routerUsers: RouterHotspotUser[],
  vouchers: HotspotVoucherSnapshot[],
  nowMs: number,
): RouterHotspotUser[] {
  const voucherByCode = new Map(
    vouchers.map((voucher) => [voucher.code, voucher]),
  );

  return routerUsers.map((row) => {
    const voucher = voucherByCode.get(row.username);
    if (!voucher) {
      return row;
    }

    const firstConnectionAt =
      voucher.activatedAt ?? voucher.session?.startedAt ?? null;
    const elapsedSinceFirstConnectionMinutes = firstConnectionAt
      ? Math.max(0, Math.floor((nowMs - firstConnectionAt.getTime()) / 60_000))
      : null;

    let remainingMinutes: number | null = null;
    let isTariffExpired: boolean | null = null;
    if (voucher.expiresAt) {
      const remainingMs = voucher.expiresAt.getTime() - nowMs;
      remainingMinutes = Math.ceil(remainingMs / 60_000);
      isTariffExpired = remainingMs <= 0;
    }

    const enforcementStatus: RouterHotspotUser["enforcementStatus"] =
      isTariffExpired === true
        ? row.active
          ? "EXPIRED_BUT_ACTIVE"
          : "EXPIRED"
        : row.active
          ? "ACTIVE_OK"
          : "INACTIVE_OK";

    return {
      ...row,
      managedByMikroServer: true,
      planName: voucher.plan?.name ?? null,
      planDurationMinutes: voucher.plan?.durationMinutes ?? null,
      voucherStatus: voucher.status,
      firstConnectionAt,
      elapsedSinceFirstConnectionMinutes,
      voucherExpiresAt: voucher.expiresAt,
      remainingMinutes,
      isTariffExpired,
      enforcementStatus,
    } satisfies RouterHotspotUser;
  });
}

export function filterAndSortRouterHotspotUsers(
  routerUsers: RouterHotspotUser[],
  normalizedSearch: string,
): RouterHotspotUser[] {
  return routerUsers
    .filter((row) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        row.username.toLowerCase().includes(normalizedSearch) ||
        (row.profile ?? "").toLowerCase().includes(normalizedSearch) ||
        (row.comment ?? "").toLowerCase().includes(normalizedSearch) ||
        (row.planName ?? "").toLowerCase().includes(normalizedSearch) ||
        row.enforcementStatus.toLowerCase().includes(normalizedSearch)
      );
    })
    .sort((a, b) => {
      if (a.active !== b.active) {
        return a.active ? -1 : 1;
      }

      if (a.enforcementStatus !== b.enforcementStatus) {
        if (a.enforcementStatus === "EXPIRED_BUT_ACTIVE") {
          return -1;
        }
        if (b.enforcementStatus === "EXPIRED_BUT_ACTIVE") {
          return 1;
        }
      }

      return a.username.localeCompare(b.username);
    });
}
