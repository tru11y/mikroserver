import { addMinutes } from "date-fns";
import type {
  HotspotActiveClient,
  HotspotUserRecord,
  LegacyTicketLookupResult,
} from "./router-api.types";
import {
  compareLegacyPassword,
  deriveActivatedAt,
  isRouterBooleanTrue,
  parseRouterDurationMinutes,
} from "./router-api.utils";

export function normalizeLegacyCodeCandidates(
  codeCandidates: string[],
): string[] {
  return Array.from(
    new Set(
      codeCandidates
        .map((candidate) => candidate.trim())
        .filter((candidate) => candidate.length > 0),
    ),
  );
}

export async function findLegacyTicketOnRouter(params: {
  candidates: string[];
  passwordCandidates: string[];
  router: {
    id: string;
    name: string;
  };
  findUsers: (username: string) => Promise<HotspotUserRecord[]>;
  findActiveClients: (username: string) => Promise<HotspotActiveClient[]>;
}): Promise<LegacyTicketLookupResult | null> {
  const {
    candidates,
    passwordCandidates,
    router,
    findUsers,
    findActiveClients,
  } = params;

  for (const candidate of candidates) {
    // RouterOS candidate reads stay sequential to avoid flaky parallel channels.
    const userRows = await findUsers(candidate);
    const activeRows = await findActiveClients(candidate);

    const activeClient = activeRows[0];
    const hotspotUser =
      userRows[0] ??
      (activeClient ? (await findUsers(activeClient.user))[0] : undefined);

    if (!hotspotUser && !activeClient) {
      continue;
    }

    const code = activeClient?.user ?? hotspotUser?.name ?? candidate;
    const durationMinutes = parseRouterDurationMinutes(
      hotspotUser?.["limit-uptime"],
    );
    const activatedAt = activeClient
      ? deriveActivatedAt(activeClient.uptime)
      : null;
    const expiresAt =
      activatedAt && durationMinutes > 0
        ? addMinutes(activatedAt, durationMinutes)
        : null;

    return {
      routerId: router.id,
      routerName: router.name,
      code,
      active: Boolean(activeClient),
      disabled: isRouterBooleanTrue(hotspotUser?.disabled),
      planName: hotspotUser?.profile?.trim() || "Ticket legacy",
      durationMinutes,
      deliveredAt: null,
      activatedAt,
      expiresAt,
      passwordMatches: compareLegacyPassword(
        hotspotUser?.password,
        passwordCandidates,
      ),
    };
  }

  return null;
}
