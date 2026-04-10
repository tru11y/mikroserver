import type {
  HotspotActiveClient,
  HotspotUserRecord,
  LegacyTicketLookupResult,
  MikroTikConnection,
  MikroTikModule,
} from "./router-api.types";
import {
  findLegacyTicketOnRouter,
  normalizeLegacyCodeCandidates,
} from "./router-legacy-ticket.utils";
import type { RouterConnectionTarget } from "./router-operations.types";

interface LegacyRouterLookupTarget extends RouterConnectionTarget {
  id: string;
  name: string;
}

interface RouterLegacyTicketDeps {
  prisma: {
    router: {
      findMany: (args: {
        where: {
          deletedAt: null;
          id?: string;
          wireguardIp?: { not: null };
        };
        select: {
          id: true;
          name: true;
          wireguardIp: true;
          apiPort: true;
          apiUsername: true;
          apiPasswordHash: true;
          hotspotServer: true;
        };
      }) => Promise<
        (Omit<LegacyRouterLookupTarget, "wireguardIp"> & {
          wireguardIp: string | null;
        })[]
      >;
    };
  };
  parseItems: MikroTikModule["parseItems"];
  executeOnRouterResult: <T>(
    router: RouterConnectionTarget,
    operation: (conn: MikroTikConnection) => Promise<T>,
  ) => Promise<T>;
  findUsers: (
    conn: MikroTikConnection,
    parseItems: MikroTikModule["parseItems"],
    username: string,
  ) => Promise<HotspotUserRecord[]>;
  findActiveClients: (
    conn: MikroTikConnection,
    parseItems: MikroTikModule["parseItems"],
    hotspotServer: string | null,
    username: string,
  ) => Promise<HotspotActiveClient[]>;
  logger: {
    warn: (message: string) => void;
  };
}

export async function findLegacyTicketAcrossRouters(
  codeCandidates: string[],
  passwordCandidates: string[],
  preferredRouterId: string | undefined,
  deps: RouterLegacyTicketDeps,
): Promise<LegacyTicketLookupResult | null> {
  const normalizedCodes = normalizeLegacyCodeCandidates(codeCandidates);

  if (normalizedCodes.length === 0) {
    return null;
  }

  const routers = await deps.prisma.router.findMany({
    where: {
      deletedAt: null,
      wireguardIp: { not: null },
      ...(preferredRouterId ? { id: preferredRouterId } : {}),
    },
    select: {
      id: true,
      name: true,
      wireguardIp: true,
      apiPort: true,
      apiUsername: true,
      apiPasswordHash: true,
      hotspotServer: true,
    },
  });

  for (const router of routers as LegacyRouterLookupTarget[]) {
    try {
      const match =
        await deps.executeOnRouterResult<LegacyTicketLookupResult | null>(
          router,
          async (conn) =>
            findLegacyTicketOnRouter({
              candidates: normalizedCodes,
              passwordCandidates,
              router: {
                id: router.id,
                name: router.name,
              },
              findUsers: (username) =>
                deps.findUsers(conn, deps.parseItems, username),
              findActiveClients: (username) =>
                deps.findActiveClients(
                  conn,
                  deps.parseItems,
                  router.hotspotServer ?? null,
                  username,
                ),
            }),
        );

      if (match) {
        return match;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.logger.warn(
        `Legacy ticket lookup failed on router ${router.name} (${router.wireguardIp}): ${message}`,
      );
    }
  }

  return null;
}
