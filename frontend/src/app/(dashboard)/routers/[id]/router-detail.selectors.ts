import type {
  HotspotProfile,
  HotspotUserRow,
  LiveClient,
  PlanSummary,
  RouterComplianceCheck,
  RouterDetail,
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

export function buildRouterConfigChecks(
  routerInfo: RouterDetail,
  plansWithProfileInfo: PlanWithProfileInfo[],
  complianceSummary: HotspotComplianceSummary,
  now: Date = new Date(),
): RouterComplianceCheck[] {
  const checks: RouterComplianceCheck[] = [];
  const metadata = routerInfo.metadata ?? {};

  checks.push({
    id: 'wg-ip',
    category: 'connectivity',
    severity: routerInfo.wireguardIp ? 'ok' : 'critical',
    label: 'Tunnel WireGuard',
    description: routerInfo.wireguardIp
      ? `Tunnel configuré — ${routerInfo.wireguardIp}`
      : 'Aucune IP WireGuard configurée — le routeur est inaccessible via le VPN.',
  });

  const failures = metadata.consecutiveHealthFailures ?? 0;
  checks.push({
    id: 'health-failures',
    category: 'connectivity',
    severity: failures === 0 ? 'ok' : failures >= 3 ? 'critical' : 'warning',
    label: 'Connexion API RouterOS',
    description:
      failures === 0
        ? 'Aucun échec consécutif — connexion API stable.'
        : `${failures} échec${failures > 1 ? 's' : ''} consécutif${failures > 1 ? 's' : ''} — vérifier les identifiants et le port API.`,
    actionId: failures > 0 ? 'health_check' : undefined,
    actionLabel: failures > 0 ? 'Lancer health check' : undefined,
  });

  if (metadata.lastHealthCheckAt) {
    const diffMin =
      (now.getTime() - new Date(metadata.lastHealthCheckAt).getTime()) / 60_000;
    checks.push({
      id: 'health-recency',
      category: 'connectivity',
      severity: diffMin <= 10 ? 'ok' : diffMin <= 30 ? 'warning' : 'critical',
      label: 'Fraîcheur health check',
      description:
        diffMin <= 10
          ? `Dernier health check il y a ${Math.round(diffMin)} min.`
          : `Dernier health check il y a ${Math.round(diffMin)} min — trop ancien.`,
      actionId: diffMin > 10 ? 'health_check' : undefined,
      actionLabel: diffMin > 10 ? 'Lancer health check' : undefined,
    });
  } else {
    checks.push({
      id: 'health-recency',
      category: 'connectivity',
      severity: 'warning',
      label: 'Fraîcheur health check',
      description: 'Aucun health check enregistré pour ce routeur.',
      actionId: 'health_check',
      actionLabel: 'Lancer health check',
    });
  }

  if (metadata.lastSyncAt) {
    const diffMin =
      (now.getTime() - new Date(metadata.lastSyncAt).getTime()) / 60_000;
    checks.push({
      id: 'sync-recency',
      category: 'connectivity',
      severity: diffMin <= 15 ? 'ok' : diffMin <= 60 ? 'warning' : 'critical',
      label: 'Fraîcheur synchronisation',
      description:
        diffMin <= 15
          ? `Dernière synchronisation il y a ${Math.round(diffMin)} min.`
          : `Dernière synchronisation il y a ${Math.round(diffMin)} min — synchroniser pour mettre à jour.`,
      actionId: diffMin > 15 ? 'sync' : undefined,
      actionLabel: diffMin > 15 ? 'Synchroniser' : undefined,
    });
  } else {
    checks.push({
      id: 'sync-recency',
      category: 'connectivity',
      severity: 'warning',
      label: 'Fraîcheur synchronisation',
      description: 'Aucune synchronisation enregistrée pour ce routeur.',
      actionId: 'sync',
      actionLabel: 'Synchroniser',
    });
  }

  checks.push({
    id: 'hotspot-server',
    category: 'configuration',
    severity: routerInfo.hotspotServer ? 'ok' : 'critical',
    label: 'Serveur hotspot',
    description: routerInfo.hotspotServer
      ? `Serveur configuré : "${routerInfo.hotspotServer}".`
      : "Aucun serveur hotspot configuré — les clients ne peuvent pas s'authentifier.",
  });

  checks.push({
    id: 'hotspot-profile',
    category: 'configuration',
    severity: routerInfo.hotspotProfile ? 'ok' : 'critical',
    label: 'Profil hotspot par défaut',
    description: routerInfo.hotspotProfile
      ? `Profil par défaut : "${routerInfo.hotspotProfile}".`
      : 'Aucun profil hotspot configuré — les nouveaux clients recevront un profil inconnu.',
  });

  if (plansWithProfileInfo.length > 0) {
    const unmappedPlans = plansWithProfileInfo.filter((p) => !p.mappedProfile);
    checks.push({
      id: 'plan-profile-mapping',
      category: 'configuration',
      severity: unmappedPlans.length === 0 ? 'ok' : 'warning',
      label: 'Mapping forfaits → profils',
      description:
        unmappedPlans.length === 0
          ? `Tous les forfaits (${plansWithProfileInfo.length}) ont un profil RouterOS mappé.`
          : `${unmappedPlans.length} forfait${unmappedPlans.length > 1 ? 's' : ''} sans profil RouterOS mappé : ${unmappedPlans.map((p) => p.plan.name).join(', ')}.`,
    });
  }

  if (complianceSummary.total > 0) {
    const expired = complianceSummary.expiredButActive.length;
    checks.push({
      id: 'no-expired-active',
      category: 'sessions',
      severity: expired === 0 ? 'ok' : 'critical',
      label: 'Clients expirés actifs',
      description:
        expired === 0
          ? 'Aucun client actif avec forfait expiré détecté.'
          : `${expired} client${expired > 1 ? 's' : ''} actif${expired > 1 ? 's' : ''} avec forfait expiré — vérifier la politique d'éjection du routeur.`,
      actionId: expired > 0 ? 'disconnect_expired' : undefined,
      actionLabel: expired > 0 ? 'Déconnecter les expirés' : undefined,
    });

    const unmanaged = complianceSummary.unmanaged;
    const unmanagedPct =
      complianceSummary.total > 0
        ? Math.round((unmanaged / complianceSummary.total) * 100)
        : 0;
    checks.push({
      id: 'unmanaged-users',
      category: 'sessions',
      severity: unmanaged === 0 ? 'ok' : unmanagedPct > 50 ? 'warning' : 'ok',
      label: 'Utilisateurs non gérés',
      description:
        unmanaged === 0
          ? 'Tous les utilisateurs actifs sont gérés par MikroServer.'
          : `${unmanaged} utilisateur${unmanaged > 1 ? 's' : ''} non lié${unmanaged > 1 ? 's' : ''} à un ticket MikroServer (${unmanagedPct} %).`,
    });
  }

  return checks;
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
      ? `Alerte : ${expiredButActive.length} client(s) actif(s) dépassent la durée autorisée. Vérifiez la politique d'éjection hotspot (scheduler/script) du routeur.`
      : expiringSoon.length > 0
        ? `Surveillance : ${expiringSoon.length} client(s) actif(s) approchent la fin de forfait dans moins de 30 minutes.`
        : managed > 0
          ? 'Conforme : aucun client actif expiré détecté sur les forfaits gérés par MikroServer.'
          : 'Information : les utilisateurs affichés ne sont pas liés à des tickets gérés par MikroServer.';

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
