import type {
  HotspotUserProfileRecord,
  MikroTikConnection,
  MikroTikModule,
  RouterHotspotUserProfile,
} from "./router-api.types";
import {
  buildCreateHotspotUserProfileCommands,
  buildUpdateHotspotUserProfileCommands,
  findCreatedHotspotUserProfile,
  mapAndSortHotspotUserProfiles,
} from "./router-hotspot-profiles.utils";
import {
  removeById,
  runCommand,
  runParsedCommand,
} from "./router-api.commands";
import type { RouterConnectionTarget } from "./router-operations.types";

interface RouterHotspotProfilesDeps {
  parseItems: MikroTikModule["parseItems"];
  executeOnRouterResult: <T>(
    router: RouterConnectionTarget,
    operation: (conn: MikroTikConnection) => Promise<T>,
  ) => Promise<T>;
}

export async function getRouterHotspotUserProfiles(
  router: RouterConnectionTarget,
  deps: RouterHotspotProfilesDeps,
): Promise<RouterHotspotUserProfile[]> {
  const rows = await deps.executeOnRouterResult<HotspotUserProfileRecord[]>(
    router,
    async (conn) =>
      runParsedCommand<HotspotUserProfileRecord>(
        conn,
        deps.parseItems,
        "/ip/hotspot/user/profile/print",
      ),
  );

  return mapAndSortHotspotUserProfiles(rows);
}

export async function createRouterHotspotUserProfile(
  router: RouterConnectionTarget,
  params: {
    name: string;
    rateLimit?: string;
    sharedUsers?: number;
    sessionTimeout?: string;
    idleTimeout?: string;
    keepaliveTimeout?: string;
    addressPool?: string;
  },
  deps: RouterHotspotProfilesDeps,
): Promise<RouterHotspotUserProfile> {
  return deps.executeOnRouterResult<RouterHotspotUserProfile>(
    router,
    async (conn) => {
      const existingRows = await runParsedCommand<HotspotUserProfileRecord>(
        conn,
        deps.parseItems,
        "/ip/hotspot/user/profile/print",
      );
      const existingIds = new Set(
        existingRows
          .map((row) => row[".id"])
          .filter((id): id is string => Boolean(id)),
      );

      await runCommand(conn, buildCreateHotspotUserProfileCommands(params));

      const refreshedRows = await runParsedCommand<HotspotUserProfileRecord>(
        conn,
        deps.parseItems,
        "/ip/hotspot/user/profile/print",
      );

      const created = findCreatedHotspotUserProfile(
        refreshedRows,
        existingIds,
        params.name,
      );

      if (!created) {
        throw new Error(`Profil hotspot ${params.name} cree mais introuvable`);
      }

      return mapAndSortHotspotUserProfiles([created])[0]!;
    },
  );
}

export async function updateRouterHotspotUserProfileConfig(
  router: RouterConnectionTarget,
  params: {
    profileId: string;
    name?: string;
    rateLimit?: string;
    sharedUsers?: number;
    sessionTimeout?: string;
    idleTimeout?: string;
    keepaliveTimeout?: string;
    addressPool?: string;
  },
  deps: RouterHotspotProfilesDeps,
): Promise<RouterHotspotUserProfile> {
  return deps.executeOnRouterResult<RouterHotspotUserProfile>(
    router,
    async (conn) => {
      const allRows = await runParsedCommand<HotspotUserProfileRecord>(
        conn,
        deps.parseItems,
        "/ip/hotspot/user/profile/print",
      );
      const existing = allRows.find((row) => row[".id"] === params.profileId);

      if (!existing?.[".id"]) {
        throw new Error(`Profil hotspot ${params.profileId} introuvable`);
      }

      const { commands, hasUpdate } = buildUpdateHotspotUserProfileCommands(
        params,
        existing,
      );

      if (!hasUpdate) {
        throw new Error("Aucun champ a mettre a jour pour le profil hotspot");
      }

      await runCommand(conn, commands);

      const refreshedRows = await runParsedCommand<HotspotUserProfileRecord>(
        conn,
        deps.parseItems,
        "/ip/hotspot/user/profile/print",
      );
      const refreshed =
        refreshedRows.find((row) => row[".id"] === params.profileId) ??
        existing;

      return mapAndSortHotspotUserProfiles([refreshed])[0]!;
    },
  );
}

export async function removeRouterHotspotUserProfile(
  router: RouterConnectionTarget,
  profileId: string,
  deps: RouterHotspotProfilesDeps,
): Promise<void> {
  await deps.executeOnRouterResult<void>(router, async (conn) => {
    const allRows = await runParsedCommand<HotspotUserProfileRecord>(
      conn,
      deps.parseItems,
      "/ip/hotspot/user/profile/print",
    );
    const existing = allRows.find((row) => row[".id"] === profileId);

    if (!existing?.[".id"]) {
      throw new Error(`Profil hotspot ${profileId} introuvable`);
    }

    await removeById(conn, "/ip/hotspot/user/profile/remove", profileId);
  });
}
