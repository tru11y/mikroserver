import {
  enrichRouterHotspotUsersWithVouchers,
  filterAndSortRouterHotspotUsers,
  mapRouterHotspotUsers,
} from "./router-hotspot-users.utils";
import type {
  HotspotActiveClient,
  HotspotUserRecord,
  RouterHotspotUser,
} from "./router-api.types";

describe("router hotspot users utils", () => {
  it("maps router user + active rows into normalized hotspot users", () => {
    const userRows: HotspotUserRecord[] = [
      {
        ".id": "*1",
        name: "alice",
        profile: "default",
        comment: "VIP",
        disabled: "yes",
        uptime: "00:10:00",
        "limit-uptime": "1d",
      },
      {
        ".id": "",
        name: "ignored",
      },
    ];
    const activeRows: HotspotActiveClient[] = [
      {
        user: "alice",
        address: "10.0.0.2",
        "mac-address": "AA:BB:CC:DD:EE:FF",
      } as HotspotActiveClient,
    ];

    const mapped = mapRouterHotspotUsers(userRows, activeRows);

    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      id: "*1",
      username: "alice",
      active: true,
      activeSessionCount: 1,
      activeAddress: "10.0.0.2",
      activeMacAddress: "AA:BB:CC:DD:EE:FF",
      disabled: true,
      enforcementStatus: "UNMANAGED",
    });
  });

  it("enriches users with voucher metadata and computes expiry statuses", () => {
    const baseUsers: RouterHotspotUser[] = [
      {
        id: "*1",
        username: "alice",
        profile: "default",
        comment: null,
        disabled: false,
        active: true,
        activeSessionCount: 1,
        activeAddress: null,
        activeMacAddress: null,
        uptime: null,
        limitUptime: null,
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
      },
    ];

    const nowMs = new Date("2026-03-24T12:00:00.000Z").getTime();
    const vouchers = [
      {
        code: "alice",
        status: "ACTIVE",
        activatedAt: new Date("2026-03-24T10:00:00.000Z"),
        expiresAt: new Date("2026-03-24T11:58:00.000Z"),
        session: null,
        plan: {
          name: "Plan 2h",
          durationMinutes: 120,
        },
      },
    ];

    const enriched = enrichRouterHotspotUsersWithVouchers(
      baseUsers,
      vouchers,
      nowMs,
    );

    expect(enriched).toHaveLength(1);
    expect(enriched[0]).toMatchObject({
      managedByMikroServer: true,
      planName: "Plan 2h",
      planDurationMinutes: 120,
      voucherStatus: "ACTIVE",
      isTariffExpired: true,
      enforcementStatus: "EXPIRED_BUT_ACTIVE",
    });
    expect(enriched[0]?.remainingMinutes).toBeLessThanOrEqual(0);
    expect(enriched[0]?.elapsedSinceFirstConnectionMinutes).toBe(120);
  });

  it("filters by search and prioritizes active / expired-but-active users first", () => {
    const rows: RouterHotspotUser[] = [
      {
        id: "*1",
        username: "charlie",
        profile: "default",
        comment: null,
        disabled: false,
        active: false,
        activeSessionCount: 0,
        activeAddress: null,
        activeMacAddress: null,
        uptime: null,
        limitUptime: null,
        managedByMikroServer: true,
        planName: "Bronze",
        planDurationMinutes: 60,
        voucherStatus: "ACTIVE",
        firstConnectionAt: null,
        elapsedSinceFirstConnectionMinutes: null,
        voucherExpiresAt: null,
        remainingMinutes: null,
        isTariffExpired: false,
        enforcementStatus: "INACTIVE_OK",
      },
      {
        id: "*2",
        username: "alice",
        profile: "vip",
        comment: "team-a",
        disabled: false,
        active: true,
        activeSessionCount: 1,
        activeAddress: null,
        activeMacAddress: null,
        uptime: null,
        limitUptime: null,
        managedByMikroServer: true,
        planName: "Gold",
        planDurationMinutes: 120,
        voucherStatus: "ACTIVE",
        firstConnectionAt: null,
        elapsedSinceFirstConnectionMinutes: null,
        voucherExpiresAt: null,
        remainingMinutes: null,
        isTariffExpired: true,
        enforcementStatus: "EXPIRED_BUT_ACTIVE",
      },
    ];

    const filtered = filterAndSortRouterHotspotUsers(rows, "a");

    expect(filtered).toHaveLength(2);
    expect(filtered[0]?.username).toBe("alice");
    expect(filtered[1]?.username).toBe("charlie");
  });
});
