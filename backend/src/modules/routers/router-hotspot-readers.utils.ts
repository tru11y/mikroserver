import type {
  HotspotActiveClient,
  HotspotHostRecord,
  HotspotIpBindingRecord,
  HotspotUserRecord,
  RouterHotspotUser,
} from "./router-api.types";
import { mapRouterHotspotUsers } from "./router-hotspot-users.utils";

type RunRouterPrintCommand = <T>(
  command: string,
  parameters?: string[],
) => Promise<T[]>;

function buildHotspotActiveParameters(hotspotServer: string | null): string[] {
  return hotspotServer ? [`?server=${hotspotServer}`] : [];
}

export async function readHotspotIpBindingsSnapshot(params: {
  runParsedCommand: RunRouterPrintCommand;
  hotspotServer: string | null;
}): Promise<{
  ipBindings: HotspotIpBindingRecord[];
  hosts: HotspotHostRecord[];
  active: HotspotActiveClient[];
}> {
  // RouterOS reads are intentionally sequential here.
  // In production, parallel channels on the same connection have proven flaky.
  const ipBindings = await params.runParsedCommand<HotspotIpBindingRecord>(
    "/ip/hotspot/ip-binding/print",
  );
  const hosts = await params.runParsedCommand<HotspotHostRecord>(
    "/ip/hotspot/host/print",
  );
  const active = await params.runParsedCommand<HotspotActiveClient>(
    "/ip/hotspot/active/print",
    buildHotspotActiveParameters(params.hotspotServer),
  );

  return { ipBindings, hosts, active };
}

export async function readMappedHotspotUsers(params: {
  runParsedCommand: RunRouterPrintCommand;
  hotspotServer: string | null;
}): Promise<RouterHotspotUser[]> {
  // Same sequential policy as IP bindings: reliability beats theoretical speed.
  const userRows = await params.runParsedCommand<HotspotUserRecord>(
    "/ip/hotspot/user/print",
  );
  const activeRows = await params.runParsedCommand<HotspotActiveClient>(
    "/ip/hotspot/active/print",
    buildHotspotActiveParameters(params.hotspotServer),
  );

  return mapRouterHotspotUsers(userRows, activeRows);
}
