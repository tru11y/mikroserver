import type {
  HotspotProfile,
  HotspotUserRow,
  LiveClient,
  PlanSummary,
} from './router-detail.types';
import { normalizeProfileName, parseRouterUptimeToSeconds } from './router-detail.utils';

export interface PlanWithProfileInfo {
  plan: PlanSummary;
  mappedProfile: HotspotProfile | undefined;
}

export interface HotspotComplianceSummary {
  total: number;
  managed: number;
  unmanaged: number;
  expiredButActive: HotspotUserRow[];
  expiredInactive: HotspotUserRow[];
  expiringSoon: HotspotUserRow[];
  recommendation: string;
}

export interface LiveClientWithHotspotMeta extends LiveClient {
  hotspotUser: HotspotUserRow | null;
}

export type LiveClientSortColumn = 'username' | 'bytesIn' | 'bytesOut' | 'uptime';
export type SortDirection = 'asc' | 'desc';

function collectProfileNames(
  values: Array<string | null | undefined>,
  profilesByNormalizedName: Map<string, string>,
) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeProfileName(trimmed);
    if (!normalized || profilesByNormalizedName.has(normalized)) {
      continue;
    }

    profilesByNormalizedName.set(normalized, trimmed);
  }
}

export function buildAvailableHotspotProfileNames(
  hotspotProfiles: HotspotProfile[],
  hotspotUsers: HotspotUserRow[],
  plans: PlanSummary[],
  routerDefaultProfile?: string | null,
  currentUserProfile?: string | null,
): string[] {
  const profilesByNormalizedName = new Map<string, string>();

  collectProfileNames(
    hotspotProfiles.map((profile) => profile.name),
    profilesByNormalizedName,
  );
  collectProfileNames(
    hotspotUsers.map((user) => user.profile),
    profilesByNormalizedName,
  );
  collectProfileNames(
    plans.map((plan) => plan.userProfile),
    profilesByNormalizedName,
  );
  collectProfileNames([routerDefaultProfile, currentUserProfile], profilesByNormalizedName);

  return Array.from(profilesByNormalizedName.values()).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function buildFallbackHotspotProfileNames(
  hotspotProfiles: HotspotProfile[],
  hotspotUsers: HotspotUserRow[],
  plans: PlanSummary[],
  routerDefaultProfile?: string | null,
): string[] {
  const existingProfileNames = new Set(
    hotspotProfiles.map((profile) => normalizeProfileName(profile.name)),
  );

  return buildAvailableHotspotProfileNames(
    hotspotProfiles,
    hotspotUsers,
    plans,
    routerDefaultProfile,
  ).filter((profileName) => !existingProfileNames.has(normalizeProfileName(profileName)));
}

export function buildSelectableHotspotProfileNames(
  availableProfileNames: string[],
  currentUserProfile?: string | null,
): string[] {
  const profilesByNormalizedName = new Map<string, string>();

  collectProfileNames(availableProfileNames, profilesByNormalizedName);
  collectProfileNames([currentUserProfile], profilesByNormalizedName);

  return Array.from(profilesByNormalizedName.values()).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function buildPlansWithProfileInfo(
  plans: PlanSummary[],
  hotspotProfiles: HotspotProfile[],
): PlanWithProfileInfo[] {
  return plans.map((plan) => {
    const mappedProfile = hotspotProfiles.find(
      (profile) =>
        normalizeProfileName(profile.name) ===
        normalizeProfileName(plan.userProfile ?? 'default'),
    );

    return {
      plan,
      mappedProfile,
    };
  });
}

export function buildLegacyTariffProfiles(
  plans: PlanSummary[],
  hotspotProfiles: HotspotProfile[],
): HotspotProfile[] {
  const planProfileNames = new Set(
    plans.map((plan) => normalizeProfileName(plan.userProfile ?? 'default')),
  );

  return hotspotProfiles.filter(
    (profile) => !planProfileNames.has(normalizeProfileName(profile.name)),
  );
}

export function filterHotspotUsers(
  users: HotspotUserRow[],
  searchQuery: string,
): HotspotUserRow[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return users;
  }

  return users.filter((user) => {
    return (
      user.username.toLowerCase().includes(query) ||
      (user.profile ?? '').toLowerCase().includes(query) ||
      (user.comment ?? '').toLowerCase().includes(query)
    );
  });
}

export function attachHotspotUsersToLiveClients(
  clients: LiveClient[],
  users: HotspotUserRow[],
): LiveClientWithHotspotMeta[] {
  const usersByUsername = new Map(
    users.map((user) => [user.username.trim().toLowerCase(), user]),
  );

  return clients.map((client) => ({
    ...client,
    hotspotUser:
      usersByUsername.get(client.username.trim().toLowerCase()) ?? null,
  }));
}

export function sortLiveClients(
  clients: LiveClientWithHotspotMeta[],
  sortCol: LiveClientSortColumn,
  sortDir: SortDirection,
): LiveClientWithHotspotMeta[] {
  const directionFactor = sortDir === 'desc' ? -1 : 1;

  return [...clients].sort((left, right) => {
    if (sortCol === 'username') {
      return directionFactor * left.username.localeCompare(right.username);
    }

    if (sortCol === 'uptime') {
      return (
        directionFactor *
        (parseRouterUptimeToSeconds(left.uptime) - parseRouterUptimeToSeconds(right.uptime))
      );
    }

    return directionFactor * ((left[sortCol] as number) - (right[sortCol] as number));
  });
}

export function buildHotspotComplianceSummary(
  users: HotspotUserRow[],
): HotspotComplianceSummary {
  const total = users.length;
  const managed = users.filter((user) => user.managedByMikroServer).length;
  const unmanaged = total - managed;
  const expiredButActive = users.filter(
    (user) => user.enforcementStatus === 'EXPIRED_BUT_ACTIVE',
  );
  const expiredInactive = users.filter(
    (user) => user.enforcementStatus === 'EXPIRED',
  );
  const expiringSoon = users.filter(
    (user) =>
      user.active &&
      user.remainingMinutes !== null &&
      user.remainingMinutes > 0 &&
      user.remainingMinutes <= 30,
  );

  const recommendation =
    expiredButActive.length > 0
      ? `Alerte: ${expiredButActive.length} client(s) actif(s) semblent depasser la duree autorisee. Verifie la politique d ejection hotspot (scheduler/script) du routeur.`
      : expiringSoon.length > 0
        ? `Surveillance: ${expiringSoon.length} client(s) actif(s) approchent la fin de forfait dans moins de 30 minutes.`
        : managed > 0
          ? 'Conforme: aucun client actif expire detecte sur les forfaits geres par MikroServer.'
          : 'Information: les utilisateurs affiches ne sont pas lies a des tickets geres par MikroServer.';

  return {
    total,
    managed,
    unmanaged,
    expiredButActive,
    expiredInactive,
    expiringSoon,
    recommendation,
  };
}
