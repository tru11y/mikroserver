import type { MikroTikConnection, MikroTikModule } from "./router-api.types";
import {
  findActiveSessionIds,
  findHotspotUserIds,
  removeById,
  updateHotspotUserRateLimit,
} from "./router-api.commands";
import type { RouterConnectionTarget } from "./router-operations.types";

interface RouterHotspotWritesDeps {
  parseItems: MikroTikModule["parseItems"];
  executeOnRouter: (
    router: RouterConnectionTarget,
    operation: (conn: MikroTikConnection) => Promise<void>,
  ) => Promise<void>;
  executeOnRouterResult: <T>(
    router: RouterConnectionTarget,
    operation: (conn: MikroTikConnection) => Promise<T>,
  ) => Promise<T>;
  logger: {
    log: (message: string) => void;
  };
}

export async function removeRouterHotspotUser(
  router: RouterConnectionTarget,
  username: string,
  deps: RouterHotspotWritesDeps,
): Promise<void> {
  await deps.executeOnRouter(router, async (conn) => {
    const userIds = await findHotspotUserIds(conn, deps.parseItems, username);
    for (const userId of userIds) {
      await removeById(conn, "/ip/hotspot/user/remove", userId);
    }
  });

  deps.logger.log(
    `Removed hotspot user ${username} from router ${router.wireguardIp}`,
  );
}

export async function disconnectRouterHotspotActiveSessionsByUsername(
  router: RouterConnectionTarget,
  username: string,
  deps: RouterHotspotWritesDeps,
): Promise<number> {
  const removedCount = await deps.executeOnRouterResult<number>(
    router,
    async (conn) => {
      const activeIds = await findActiveSessionIds(
        conn,
        deps.parseItems,
        username,
      );
      for (const activeId of activeIds) {
        await removeById(conn, "/ip/hotspot/active/remove", activeId);
      }
      return activeIds.length;
    },
  );

  deps.logger.log(
    `Disconnected ${removedCount} active session(s) for ${username} on router ${router.wireguardIp}`,
  );

  return removedCount;
}

export async function disconnectRouterHotspotActiveSession(
  router: RouterConnectionTarget,
  mikrotikId: string,
  deps: RouterHotspotWritesDeps,
): Promise<void> {
  await deps.executeOnRouter(router, async (conn) => {
    await removeById(conn, "/ip/hotspot/active/remove", mikrotikId);
  });

  deps.logger.log(
    `Disconnected active session ${mikrotikId} from router ${router.wireguardIp}`,
  );
}

export async function updateRouterHotspotUserRateLimit(
  router: RouterConnectionTarget,
  username: string,
  rateLimit: string,
  deps: RouterHotspotWritesDeps,
): Promise<void> {
  await deps.executeOnRouterResult(router, async (conn) => {
    await updateHotspotUserRateLimit(
      conn,
      deps.parseItems,
      username,
      rateLimit,
    );
  });

  deps.logger.log(
    `Updated rate-limit for hotspot user ${username} on router ${router.wireguardIp} → ${rateLimit}`,
  );
}
