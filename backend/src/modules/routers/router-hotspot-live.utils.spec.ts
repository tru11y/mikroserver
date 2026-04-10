import { buildRouterLiveStats } from "./router-hotspot-live.utils";

describe("router hotspot live utils", () => {
  it("builds totals, rates and mapped live clients", () => {
    const result = buildRouterLiveStats({
      routerId: "router-1",
      rawClients: [
        {
          ".id": "*1",
          server: "hotspot1",
          user: "ticket-1",
          address: "10.10.10.10",
          "mac-address": "AA:BB:CC:DD:EE:01",
          uptime: "00:05:00",
          "bytes-in": "3000",
          "bytes-out": "2000",
          "packets-in": "10",
          "packets-out": "11",
        },
        {
          ".id": "*2",
          server: "hotspot1",
          user: "ticket-2",
          address: "10.10.10.11",
          "mac-address": "AA:BB:CC:DD:EE:02",
          uptime: "00:03:00",
          "bytes-in": "1000",
          "bytes-out": "500",
          "packets-in": "4",
          "packets-out": "5",
        },
      ],
      syncSummary: {
        routerId: "router-1",
        activeClients: 2,
        matchedVouchers: 2,
        activatedVouchers: 0,
        disconnectedSessions: 0,
        unmatchedUsers: [],
        fetchedAt: new Date("2026-03-24T15:00:00.000Z"),
      },
      lastPoll: {
        time: Date.parse("2026-03-24T14:59:50.000Z"),
        bytesIn: 1000,
        bytesOut: 500,
      },
      nowMs: Date.parse("2026-03-24T15:00:00.000Z"),
    });

    expect(result.stats.totalBytesIn).toBe(4000);
    expect(result.stats.totalBytesOut).toBe(2500);
    expect(result.stats.rxBytesPerSec).toBe(300);
    expect(result.stats.txBytesPerSec).toBe(200);
    expect(result.stats.clients).toEqual([
      expect.objectContaining({
        id: "*1",
        username: "ticket-1",
        bytesIn: 3000,
        bytesOut: 2000,
      }),
      expect.objectContaining({
        id: "*2",
        username: "ticket-2",
        bytesIn: 1000,
        bytesOut: 500,
      }),
    ]);
    expect(result.nextPoll).toEqual({
      time: Date.parse("2026-03-24T15:00:00.000Z"),
      bytesIn: 4000,
      bytesOut: 2500,
    });
  });
});
