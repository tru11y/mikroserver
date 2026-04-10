import type {
  HotspotActiveClient,
  HotspotHostRecord,
  HotspotIpBindingRecord,
  HotspotIpBindingType,
  MikroTikConnection,
  MikroTikModule,
  RouterHotspotIpBinding,
} from "./router-api.types";
import {
  buildCreateHotspotIpBindingCommands,
  buildUpdateHotspotIpBindingCommands,
  findCreatedHotspotIpBinding,
  resolveHotspotIpBindings,
} from "./router-hotspot-ip-bindings.utils";
import { readHotspotIpBindingsSnapshot } from "./router-hotspot-readers.utils";
import {
  removeById,
  runCommand,
  runParsedCommand,
} from "./router-api.commands";
import type { RouterConnectionTarget } from "./router-operations.types";

interface RouterHotspotIpBindingsDeps {
  parseItems: MikroTikModule["parseItems"];
  executeOnRouterResult: <T>(
    router: RouterConnectionTarget,
    operation: (conn: MikroTikConnection) => Promise<T>,
  ) => Promise<T>;
}

export async function getRouterHotspotIpBindings(
  router: RouterConnectionTarget,
  deps: RouterHotspotIpBindingsDeps,
): Promise<RouterHotspotIpBinding[]> {
  const snapshot = await deps.executeOnRouterResult<{
    ipBindings: HotspotIpBindingRecord[];
    hosts: HotspotHostRecord[];
    active: HotspotActiveClient[];
  }>(router, async (conn) =>
    readHotspotIpBindingsSnapshot({
      runParsedCommand: (command, parameters = []) =>
        runParsedCommand(conn, deps.parseItems, command, parameters),
      hotspotServer: router.hotspotServer ?? null,
    }),
  );

  return resolveHotspotIpBindings(snapshot, router.hotspotServer ?? null);
}

export async function createRouterHotspotIpBinding(
  router: RouterConnectionTarget,
  params: {
    server?: string;
    address?: string;
    macAddress?: string;
    type?: HotspotIpBindingType;
    comment?: string;
    toAddress?: string;
    addressList?: string;
    disabled?: boolean;
  },
  deps: RouterHotspotIpBindingsDeps,
): Promise<RouterHotspotIpBinding> {
  return deps.executeOnRouterResult<RouterHotspotIpBinding>(
    router,
    async (conn) => {
      const existingRows = await runParsedCommand<HotspotIpBindingRecord>(
        conn,
        deps.parseItems,
        "/ip/hotspot/ip-binding/print",
      );
      const existingIds = new Set(
        existingRows
          .map((row) => row[".id"])
          .filter((id): id is string => Boolean(id)),
      );

      await runCommand(conn, buildCreateHotspotIpBindingCommands(params));

      const refreshedRows = await runParsedCommand<HotspotIpBindingRecord>(
        conn,
        deps.parseItems,
        "/ip/hotspot/ip-binding/print",
      );

      const created = findCreatedHotspotIpBinding(
        refreshedRows,
        existingIds,
        params,
      );

      if (!created) {
        throw new Error("IP binding cree mais introuvable");
      }

      return resolveHotspotIpBindings(
        { ipBindings: [created], hosts: [], active: [] },
        null,
      )[0]!;
    },
  );
}

export async function updateRouterHotspotIpBinding(
  router: RouterConnectionTarget,
  params: {
    bindingId: string;
    server?: string | null;
    address?: string | null;
    macAddress?: string | null;
    type?: HotspotIpBindingType;
    comment?: string | null;
    toAddress?: string | null;
    addressList?: string | null;
    disabled?: boolean;
  },
  deps: RouterHotspotIpBindingsDeps,
): Promise<RouterHotspotIpBinding> {
  return deps.executeOnRouterResult<RouterHotspotIpBinding>(
    router,
    async (conn) => {
      const allRows = await runParsedCommand<HotspotIpBindingRecord>(
        conn,
        deps.parseItems,
        "/ip/hotspot/ip-binding/print",
      );
      const existing = allRows.find((row) => row[".id"] === params.bindingId);

      if (!existing?.[".id"]) {
        throw new Error(`IP binding ${params.bindingId} introuvable`);
      }

      const commands = buildUpdateHotspotIpBindingCommands(params, existing);
      if (commands.length > 2) {
        await runCommand(conn, commands);
      }

      const refreshedRows = await runParsedCommand<HotspotIpBindingRecord>(
        conn,
        deps.parseItems,
        "/ip/hotspot/ip-binding/print",
      );
      const refreshed =
        refreshedRows.find((row) => row[".id"] === params.bindingId) ??
        existing;

      return resolveHotspotIpBindings(
        { ipBindings: [refreshed], hosts: [], active: [] },
        null,
      )[0]!;
    },
  );
}

export async function removeRouterHotspotIpBinding(
  router: RouterConnectionTarget,
  bindingId: string,
  deps: RouterHotspotIpBindingsDeps,
): Promise<void> {
  await deps.executeOnRouterResult<void>(router, async (conn) => {
    const allRows = await runParsedCommand<HotspotIpBindingRecord>(
      conn,
      deps.parseItems,
      "/ip/hotspot/ip-binding/print",
    );
    const existing = allRows.find((row) => row[".id"] === bindingId);

    if (!existing?.[".id"]) {
      throw new Error(`IP binding ${bindingId} introuvable`);
    }

    await removeById(conn, "/ip/hotspot/ip-binding/remove", bindingId);
  });
}
