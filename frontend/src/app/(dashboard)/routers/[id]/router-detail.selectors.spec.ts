import {
  attachHotspotUsersToLiveClients,
  buildAvailableHotspotProfileNames,
  buildFallbackHotspotProfileNames,
  buildHotspotComplianceSummary,
  buildLegacyTariffProfiles,
  buildPlansWithProfileInfo,
  buildSelectableHotspotProfileNames,
  filterHotspotUsers,
  sortLiveClients,
} from './router-detail.selectors';
import type {
  HotspotProfile,
  HotspotUserRow,
  LiveClient,
  PlanSummary,
} from './router-detail.types';

const makeUser = (overrides: Partial<HotspotUserRow> = {}): HotspotUserRow => ({
  id: 'u-1',
  username: 'alpha',
  profile: 'default',
  comment: null,
  disabled: false,
  active: false,
  activeSessionCount: 0,
  activeAddress: null,
  activeMacAddress: null,
  uptime: null,
  limitUptime: null,
  managedByMikroServer: true,
  planName: null,
  planDurationMinutes: null,
  voucherStatus: null,
  firstConnectionAt: null,
  elapsedSinceFirstConnectionMinutes: null,
  voucherExpiresAt: null,
  remainingMinutes: null,
  isTariffExpired: null,
  enforcementStatus: 'INACTIVE_OK',
  ...overrides,
});

describe('router detail selectors', () => {
  it('maps plans with existing hotspot profiles', () => {
    const plans: PlanSummary[] = [
      {
        id: 'p-1',
        name: 'Plan 1',
        status: 'ACTIVE',
        priceXof: 1000,
        durationMinutes: 60,
        userProfile: 'DEFAULT',
      },
      {
        id: 'p-2',
        name: 'Plan 2',
        status: 'ACTIVE',
        priceXof: 2000,
        durationMinutes: 120,
        userProfile: 'vip',
      },
    ];
    const profiles: HotspotProfile[] = [
      {
        id: 'h-1',
        name: 'default',
        rateLimit: null,
        sharedUsers: null,
        sessionTimeout: null,
        idleTimeout: null,
        keepaliveTimeout: null,
        addressPool: null,
      },
    ];

    const mapped = buildPlansWithProfileInfo(plans, profiles);

    expect(mapped).toHaveLength(2);
    expect(mapped[0]?.mappedProfile?.name).toBe('default');
    expect(mapped[1]?.mappedProfile).toBeUndefined();
  });

  it('builds a selectable hotspot profile catalog with fallbacks', () => {
    const profiles: HotspotProfile[] = [
      {
        id: 'h-1',
        name: 'default',
        rateLimit: null,
        sharedUsers: null,
        sessionTimeout: null,
        idleTimeout: null,
        keepaliveTimeout: null,
        addressPool: null,
      },
    ];
    const users = [
      makeUser({ id: 'u-1', username: 'alpha', profile: '7-Jours' }),
      makeUser({ id: 'u-2', username: 'beta', profile: 'default' }),
    ];
    const plans: PlanSummary[] = [
      {
        id: 'p-1',
        name: 'Plan 1',
        status: 'ACTIVE',
        priceXof: 1000,
        durationMinutes: 60,
        userProfile: '1-Mois',
      },
    ];

    expect(
      buildAvailableHotspotProfileNames(
        profiles,
        users,
        plans,
        'vip-router',
        'client-current',
      ),
    ).toEqual(['1-Mois', '7-Jours', 'client-current', 'default', 'vip-router']);

    expect(
      buildFallbackHotspotProfileNames(profiles, users, plans, 'vip-router'),
    ).toEqual(['1-Mois', '7-Jours', 'vip-router']);
  });

  it('keeps plan catalog profiles available even when RouterOS only exposes the current user profile', () => {
    const users = [makeUser({ id: 'u-1', username: 'alpha', profile: 'default' })];
    const plans: PlanSummary[] = [
      {
        id: 'p-1',
        name: 'Forfait semaine',
        status: 'ACTIVE',
        priceXof: 1500,
        durationMinutes: 7 * 24 * 60,
        userProfile: '7-Jours',
      },
      {
        id: 'p-2',
        name: 'Forfait mois',
        status: 'ACTIVE',
        priceXof: 5000,
        durationMinutes: 30 * 24 * 60,
        userProfile: '1-Mois',
      },
    ];

    expect(
      buildAvailableHotspotProfileNames([], users, plans, 'default'),
    ).toEqual(['1-Mois', '7-Jours', 'default']);
  });

  it('keeps the current user profile selectable even when the fetched catalog is incomplete', () => {
    expect(
      buildSelectableHotspotProfileNames(['1-Mois', 'default'], 'Profil-Archive'),
    ).toEqual(['1-Mois', 'default', 'Profil-Archive']);
  });

  it('returns only legacy profiles that are not mapped by plans', () => {
    const plans: PlanSummary[] = [
      {
        id: 'p-1',
        name: 'Plan 1',
        status: 'ACTIVE',
        priceXof: 1000,
        durationMinutes: 60,
        userProfile: 'default',
      },
    ];
    const profiles: HotspotProfile[] = [
      {
        id: 'h-1',
        name: 'default',
        rateLimit: null,
        sharedUsers: null,
        sessionTimeout: null,
        idleTimeout: null,
        keepaliveTimeout: null,
        addressPool: null,
      },
      {
        id: 'h-2',
        name: 'legacy-week',
        rateLimit: null,
        sharedUsers: null,
        sessionTimeout: null,
        idleTimeout: null,
        keepaliveTimeout: null,
        addressPool: null,
      },
    ];

    const legacy = buildLegacyTariffProfiles(plans, profiles);

    expect(legacy).toHaveLength(1);
    expect(legacy[0]?.name).toBe('legacy-week');
  });

  it('filters hotspot users by username/profile/comment', () => {
    const users = [
      makeUser({ id: 'u-1', username: 'alpha', profile: 'basic', comment: 'team-a' }),
      makeUser({ id: 'u-2', username: 'beta', profile: 'vip', comment: 'team-b' }),
    ];

    expect(filterHotspotUsers(users, 'vip')).toHaveLength(1);
    expect(filterHotspotUsers(users, 'team-a')).toHaveLength(1);
    expect(filterHotspotUsers(users, 'ALPHA')).toHaveLength(1);
    expect(filterHotspotUsers(users, '')).toHaveLength(2);
  });

  it('attaches hotspot metadata to live clients by username', () => {
    const users = [
      makeUser({
        id: 'u-1',
        username: 'alpha',
        planName: 'Plan Alpha',
        firstConnectionAt: '2026-03-24T08:00:00.000Z' as unknown as Date,
      }),
    ];
    const clients: LiveClient[] = [
      {
        id: 'c-1',
        username: 'Alpha',
        ipAddress: '10.0.0.10',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        uptime: '00:10:00',
        bytesIn: 10,
        bytesOut: 20,
      },
      {
        id: 'c-2',
        username: 'beta',
        ipAddress: '10.0.0.20',
        macAddress: '11:22:33:44:55:66',
        uptime: '00:05:00',
        bytesIn: 30,
        bytesOut: 40,
      },
    ];

    const enriched = attachHotspotUsersToLiveClients(clients, users);

    expect(enriched[0]?.hotspotUser?.planName).toBe('Plan Alpha');
    expect(enriched[1]?.hotspotUser).toBeNull();
  });

  it('sorts live clients by parsed uptime instead of string comparison', () => {
    const clients = attachHotspotUsersToLiveClients(
      [
        {
          id: 'c-1',
          username: 'charlie',
          ipAddress: '10.0.0.30',
          macAddress: 'AA',
          uptime: '9h2m0s',
          bytesIn: 10,
          bytesOut: 10,
        },
        {
          id: 'c-2',
          username: 'alpha',
          ipAddress: '10.0.0.10',
          macAddress: 'BB',
          uptime: '14h31m22s',
          bytesIn: 20,
          bytesOut: 20,
        },
        {
          id: 'c-3',
          username: 'bravo',
          ipAddress: '10.0.0.20',
          macAddress: 'CC',
          uptime: '2h38m2s',
          bytesIn: 30,
          bytesOut: 30,
        },
      ],
      [],
    );

    expect(sortLiveClients(clients, 'uptime', 'desc').map((client) => client.username)).toEqual([
      'alpha',
      'charlie',
      'bravo',
    ]);
  });

  it('builds a compliance summary with expired/expiring segmentation', () => {
    const users = [
      makeUser({
        id: 'u-1',
        username: 'expired-active',
        active: true,
        managedByMikroServer: true,
        enforcementStatus: 'EXPIRED_BUT_ACTIVE',
        remainingMinutes: -10,
      }),
      makeUser({
        id: 'u-2',
        username: 'expired-inactive',
        active: false,
        managedByMikroServer: true,
        enforcementStatus: 'EXPIRED',
        remainingMinutes: -5,
      }),
      makeUser({
        id: 'u-3',
        username: 'expiring-soon',
        active: true,
        managedByMikroServer: true,
        enforcementStatus: 'ACTIVE_OK',
        remainingMinutes: 20,
      }),
      makeUser({
        id: 'u-4',
        username: 'unmanaged',
        managedByMikroServer: false,
        enforcementStatus: 'UNMANAGED',
      }),
    ];

    const summary = buildHotspotComplianceSummary(users);

    expect(summary.total).toBe(4);
    expect(summary.managed).toBe(3);
    expect(summary.unmanaged).toBe(1);
    expect(summary.expiredButActive).toHaveLength(1);
    expect(summary.expiredInactive).toHaveLength(1);
    expect(summary.expiringSoon).toHaveLength(1);
    expect(summary.recommendation).toContain('Alerte');
  });
});
