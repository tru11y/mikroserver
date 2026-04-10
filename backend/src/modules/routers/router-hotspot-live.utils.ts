import type {
  HotspotActiveClient,
  RouterLiveStats,
  RouterSyncSummary,
} from "./router-api.types";

export interface RouterLivePollState {
  time: number;
  bytesIn: number;
  bytesOut: number;
}

function parseClientBytes(client: HotspotActiveClient): {
  bytesIn: number;
  bytesOut: number;
} {
  return {
    bytesIn: parseInt(client["bytes-in"] || "0", 10),
    bytesOut: parseInt(client["bytes-out"] || "0", 10),
  };
}

export function buildRouterLiveStats(params: {
  routerId: string;
  rawClients: HotspotActiveClient[];
  syncSummary: RouterSyncSummary;
  lastPoll?: RouterLivePollState;
  nowMs?: number;
}): {
  stats: RouterLiveStats;
  nextPoll: RouterLivePollState;
} {
  const {
    routerId,
    rawClients,
    syncSummary,
    lastPoll,
    nowMs = Date.now(),
  } = params;
  const fetchedAt = new Date(nowMs);

  const totals = rawClients.reduce(
    (acc, client) => {
      const bytes = parseClientBytes(client);
      acc.totalBytesIn += bytes.bytesIn;
      acc.totalBytesOut += bytes.bytesOut;
      return acc;
    },
    { totalBytesIn: 0, totalBytesOut: 0 },
  );

  let rxBytesPerSec = 0;
  let txBytesPerSec = 0;
  if (lastPoll && nowMs > lastPoll.time) {
    const dtSec = (nowMs - lastPoll.time) / 1000;
    rxBytesPerSec = Math.max(
      0,
      Math.round((totals.totalBytesIn - lastPoll.bytesIn) / dtSec),
    );
    txBytesPerSec = Math.max(
      0,
      Math.round((totals.totalBytesOut - lastPoll.bytesOut) / dtSec),
    );
  }

  return {
    stats: {
      routerId,
      activeClients: rawClients.length,
      totalBytesIn: totals.totalBytesIn,
      totalBytesOut: totals.totalBytesOut,
      rxBytesPerSec,
      txBytesPerSec,
      clients: rawClients.map((client) => {
        const bytes = parseClientBytes(client);
        return {
          id: client[".id"],
          username: client.user,
          ipAddress: client.address,
          macAddress: client["mac-address"],
          uptime: client.uptime,
          bytesIn: bytes.bytesIn,
          bytesOut: bytes.bytesOut,
        };
      }),
      fetchedAt,
      syncSummary,
    },
    nextPoll: {
      time: nowMs,
      bytesIn: totals.totalBytesIn,
      bytesOut: totals.totalBytesOut,
    },
  };
}
