import { VoucherStatus } from "@prisma/client";
import type {
  HotspotUserRecord,
  MikroTikConnection,
  MikroTikModule,
  RouterHotspotUser,
  RouterHotspotUserProfileUpdateResult,
} from "./router-api.types";
import { readMappedHotspotUsers } from "./router-hotspot-readers.utils";
import {
  enrichRouterHotspotUsersWithVouchers,
  filterAndSortRouterHotspotUsers,
} from "./router-hotspot-users.utils";
import {
  findActiveSessionIds,
  removeById,
  runParsedCommand,
  updateHotspotUserProfileById,
} from "./router-api.commands";
import type { RouterConnectionTarget } from "./router-operations.types";

interface VoucherLookupDeps {
  voucher: {
    findMany: (args: {
      where: { code: { in: string[] } };
      select: {
        code: true;
        status: true;
        activatedAt: true;
        expiresAt: true;
        session: { select: { startedAt: true } };
        plan: { select: { name: true; durationMinutes: true } };
      };
    }) => Promise<
      Array<{
        code: string;
        status: VoucherStatus;
        activatedAt: Date | null;
        expiresAt: Date | null;
        session: { startedAt: Date | null } | null;
        plan: { name: string; durationMinutes: number } | null;
      }>
    >;
  };
}

interface RouterHotspotUsersReadDeps {
  parseItems: MikroTikModule["parseItems"];
  executeOnRouterResult: <T>(
    router: RouterConnectionTarget,
    operation: (conn: MikroTikConnection) => Promise<T>,
  ) => Promise<T>;
  prisma: VoucherLookupDeps;
  nowMs?: () => number;
}

interface RouterHotspotUsersUpdateDeps {
  parseItems: MikroTikModule["parseItems"];
  executeOnRouterResult: <T>(
    router: RouterConnectionTarget,
    operation: (conn: MikroTikConnection) => Promise<T>,
  ) => Promise<T>;
}

export async function getRouterHotspotUsers(
  router: RouterConnectionTarget,
  search: string | undefined,
  deps: RouterHotspotUsersReadDeps,
): Promise<RouterHotspotUser[]> {
  const normalizedSearch = search?.trim().toLowerCase() || "";
  const routerUsers = await deps.executeOnRouterResult<RouterHotspotUser[]>(
    router,
    async (conn) =>
      readMappedHotspotUsers({
        runParsedCommand: (command, parameters = []) =>
          runParsedCommand(conn, deps.parseItems, command, parameters),
        hotspotServer: router.hotspotServer ?? null,
      }),
  );

  if (routerUsers.length === 0) {
    return [];
  }

  const usernames = Array.from(
    new Set(
      routerUsers
        .map((row) => row.username.trim())
        .filter((username) => username.length > 0),
    ),
  );

  const vouchers = await deps.prisma.voucher.findMany({
    where: {
      code: { in: usernames },
    },
    select: {
      code: true,
      status: true,
      activatedAt: true,
      expiresAt: true,
      session: {
        select: {
          startedAt: true,
        },
      },
      plan: {
        select: {
          name: true,
          durationMinutes: true,
        },
      },
    },
  });

  const enrichedUsers = enrichRouterHotspotUsersWithVouchers(
    routerUsers,
    vouchers,
    deps.nowMs ? deps.nowMs() : Date.now(),
  );

  return filterAndSortRouterHotspotUsers(enrichedUsers, normalizedSearch);
}

export async function updateRouterHotspotUserProfile(
  router: RouterConnectionTarget,
  params: {
    userId: string;
    profile: string;
    disconnectActive?: boolean;
  },
  deps: RouterHotspotUsersUpdateDeps,
): Promise<RouterHotspotUserProfileUpdateResult> {
  return deps.executeOnRouterResult<RouterHotspotUserProfileUpdateResult>(
    router,
    async (conn) => {
      const rows = await runParsedCommand<HotspotUserRecord>(
        conn,
        deps.parseItems,
        "/ip/hotspot/user/print",
      );
      const targetUser = rows.find((row) => row[".id"] === params.userId);

      if (!targetUser?.[".id"] || !targetUser.name) {
        throw new Error(`Utilisateur hotspot ${params.userId} introuvable`);
      }

      await updateHotspotUserProfileById(
        conn,
        targetUser[".id"],
        params.profile,
      );

      let disconnectedSessions = 0;
      if (params.disconnectActive) {
        const activeIds = await findActiveSessionIds(
          conn,
          deps.parseItems,
          targetUser.name,
        );
        for (const activeId of activeIds) {
          await removeById(conn, "/ip/hotspot/active/remove", activeId);
        }
        disconnectedSessions = activeIds.length;
      }

      return {
        userId: targetUser[".id"],
        username: targetUser.name,
        profile: params.profile,
        disconnectedSessions,
      };
    },
  );
}
