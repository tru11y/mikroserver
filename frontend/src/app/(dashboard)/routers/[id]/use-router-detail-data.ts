'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap, apiError } from '@/lib/api';
import { hasPermission, isAdminUser } from '@/lib/permissions';
import type {
  HotspotIpBinding,
  HotspotProfile,
  HotspotUserRow,
  LiveStats,
  PlanSummary,
  RouterDetail,
  RouterDetailSection,
} from './router-detail.types';
import {
  attachHotspotUsersToLiveClients,
  buildAvailableHotspotProfileNames,
  buildFallbackHotspotProfileNames,
  buildHotspotComplianceSummary,
  buildLegacyTariffProfiles,
  buildPlansWithProfileInfo,
  filterHotspotUsers,
  type LiveClientWithHotspotMeta,
} from './router-detail.selectors';

interface UseRouterDetailDataOptions {
  id: string;
  activeSection: RouterDetailSection;
  hotspotUserSearch: string;
}

function shouldRetryRouterRead(failureCount: number, error: unknown) {
  if (failureCount >= 1) {
    return false;
  }

  const status = (error as { response?: { status?: number } })?.response?.status;
  const message = (
    apiError(error, '') ||
    (error as Error | undefined)?.message ||
    ''
  )
    .toString()
    .toLowerCase();

  return (
    (status !== undefined && [500, 502, 503, 504].includes(status)) ||
    message.includes('timeout') ||
    message.includes('socket timeout') ||
    message.includes('network changed') ||
    message.includes('fetch failed')
  );
}

export function useRouterDetailData({
  id,
  activeSection,
  hotspotUserSearch,
}: UseRouterDetailDataOptions) {
  const deferredHotspotUserSearch = useDeferredValue(hotspotUserSearch);
  const [maxBps, setMaxBps] = useState(1);

  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canViewRouters = hasPermission(currentUser, 'routers.view');
  const canRunHealthCheck = hasPermission(currentUser, 'routers.health_check');
  const canSyncRouters = hasPermission(currentUser, 'routers.sync');
  const canManageRouters = hasPermission(currentUser, 'routers.manage');
  const canManageHotspot =
    hasPermission(currentUser, 'routers.hotspot_manage') || canManageRouters;
  const canViewPlans = hasPermission(currentUser, 'plans.view');
  const canTerminateSessions = hasPermission(currentUser, 'sessions.terminate');
  const canAdminDeleteTicket =
    isAdminUser(currentUser) && hasPermission(currentUser, 'tickets.delete');
  const hasHotspotUserSearch = deferredHotspotUserSearch.trim().length > 0;
  const shouldLoadHotspotUsers =
    activeSection === 'live' || (activeSection === 'users' && hasHotspotUserSearch);
  const shouldLoadHotspotBindings = activeSection === 'bindings';
  const shouldLoadPlans = canViewPlans;

  const { data: routerData } = useQuery({
    queryKey: ['router', id],
    queryFn: () => api.routers.get(id),
    enabled: Boolean(id) && canViewRouters,
    refetchInterval: (query) => (query.state.error ? 60_000 : 30_000),
    retry: shouldRetryRouterRead,
    retryDelay: 1500,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
  const routerInfo: RouterDetail | undefined = routerData ? unwrap<RouterDetail>(routerData) : undefined;

  const {
    data: statsData,
    isLoading: statsLoading,
    dataUpdatedAt,
    error: statsError,
  } = useQuery({
    queryKey: ['router-live', id],
    queryFn: () => api.routers.liveStats(id),
    enabled: Boolean(id) && canViewRouters,
    refetchInterval: (query) => (query.state.error ? 60_000 : 15_000),
    retry: shouldRetryRouterRead,
    retryDelay: 1500,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
  const stats: LiveStats | undefined = statsData ? unwrap<LiveStats>(statsData) : undefined;
  const statsErrorMessage =
    (apiError(statsError, '') || (statsError as Error | undefined)?.message) ?? null;

  const {
    data: hotspotProfilesData,
    isLoading: hotspotProfilesLoading,
    error: hotspotProfilesError,
  } = useQuery({
    queryKey: ['router-hotspot-profiles', id],
    queryFn: () => api.routers.hotspotProfiles(id),
    enabled: Boolean(id) && canViewRouters,
    staleTime: 5 * 60_000,
    retry: shouldRetryRouterRead,
    retryDelay: 1500,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
  const hotspotProfiles = useMemo<HotspotProfile[]>(
    () => (hotspotProfilesData ? unwrap<HotspotProfile[]>(hotspotProfilesData) : []),
    [hotspotProfilesData],
  );

  const {
    data: hotspotBindingsData,
    isLoading: hotspotBindingsLoading,
    error: hotspotBindingsError,
  } = useQuery({
    queryKey: ['router-hotspot-bindings', id],
    queryFn: () => api.routers.ipBindings(id),
    enabled: Boolean(id) && canViewRouters && shouldLoadHotspotBindings,
    staleTime: 5 * 60_000,
    retry: shouldRetryRouterRead,
    retryDelay: 1500,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
  const hotspotBindings = useMemo<HotspotIpBinding[]>(
    () => (hotspotBindingsData ? unwrap<HotspotIpBinding[]>(hotspotBindingsData) : []),
    [hotspotBindingsData],
  );

  const {
    data: hotspotUsersData,
    isLoading: hotspotUsersLoading,
    error: hotspotUsersError,
  } = useQuery({
    queryKey: [
      'router-hotspot-users',
      id,
      activeSection === 'users'
        ? deferredHotspotUserSearch.trim().toLowerCase()
        : '__live__',
    ],
    queryFn: () =>
      api.routers.hotspotUsers(
        id,
        activeSection === 'users'
          ? deferredHotspotUserSearch.trim() || undefined
          : undefined,
      ),
    enabled: Boolean(id) && canViewRouters && shouldLoadHotspotUsers,
    staleTime: 2 * 60_000,
    retry: shouldRetryRouterRead,
    retryDelay: 1500,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
  const hotspotUsers = useMemo<HotspotUserRow[]>(
    () => (hotspotUsersData ? unwrap<HotspotUserRow[]>(hotspotUsersData) : []),
    [hotspotUsersData],
  );

  const { data: plansData } = useQuery({
    queryKey: ['router-plans-quick-list'],
    queryFn: () => api.plans.list(true),
    enabled: canViewRouters && canViewPlans && shouldLoadPlans,
    staleTime: 60_000,
  });
  const allPlans = useMemo<PlanSummary[]>(
    () => (plansData ? unwrap<PlanSummary[]>(plansData) : []),
    [plansData],
  );

  const hotspotProfilesErrorMessage =
    (apiError(hotspotProfilesError, '') || (hotspotProfilesError as Error | undefined)?.message) ?? null;
  const hotspotBindingsErrorMessage =
    (apiError(hotspotBindingsError, '') || (hotspotBindingsError as Error | undefined)?.message) ?? null;
  const hotspotUsersErrorMessage =
    (apiError(hotspotUsersError, '') || (hotspotUsersError as Error | undefined)?.message) ?? null;

  const plansWithProfileInfo = useMemo(
    () => buildPlansWithProfileInfo(allPlans, hotspotProfiles),
    [allPlans, hotspotProfiles],
  );
  const legacyTariffProfiles = useMemo(
    () => buildLegacyTariffProfiles(allPlans, hotspotProfiles),
    [allPlans, hotspotProfiles],
  );
  const availableHotspotProfileNames = useMemo(
    () =>
      buildAvailableHotspotProfileNames(
        hotspotProfiles,
        hotspotUsers,
        allPlans,
        routerInfo?.hotspotProfile,
      ),
    [allPlans, hotspotProfiles, hotspotUsers, routerInfo?.hotspotProfile],
  );
  const fallbackHotspotProfileNames = useMemo(
    () =>
      buildFallbackHotspotProfileNames(
        hotspotProfiles,
        hotspotUsers,
        allPlans,
        routerInfo?.hotspotProfile,
      ),
    [allPlans, hotspotProfiles, hotspotUsers, routerInfo?.hotspotProfile],
  );
  const totalTariffItems = canViewPlans
    ? allPlans.length + legacyTariffProfiles.length
    : hotspotProfiles.length > 0
      ? hotspotProfiles.length
      : fallbackHotspotProfileNames.length;

  const filteredHotspotUsers = useMemo(
    () => filterHotspotUsers(hotspotUsers, deferredHotspotUserSearch),
    [deferredHotspotUserSearch, hotspotUsers],
  );

  const hotspotComplianceSummary = useMemo(
    () => buildHotspotComplianceSummary(hotspotUsers),
    [hotspotUsers],
  );

  const liveClients = useMemo<LiveClientWithHotspotMeta[]>(
    () => attachHotspotUsersToLiveClients(stats?.clients ?? [], hotspotUsers),
    [hotspotUsers, stats?.clients],
  );

  useEffect(() => {
    if (!stats) {
      return;
    }

    const peak = Math.max(stats.rxBytesPerSec, stats.txBytesPerSec, 1);
    setMaxBps((prev) => Math.max(prev, peak));
  }, [stats]);

  const portalHref = routerInfo
    ? `/portal?hotspot=${encodeURIComponent(routerInfo.hotspotServer)}&site=${encodeURIComponent(routerInfo.name)}`
    : '/portal';

  return {
    currentUser,
    isMeLoading,
    canViewRouters,
    canRunHealthCheck,
    canSyncRouters,
    canManageRouters,
    canManageHotspot,
    canViewPlans,
    canTerminateSessions,
    canAdminDeleteTicket,
    hasHotspotUserSearch,
    routerInfo,
    stats,
    statsLoading,
    dataUpdatedAt,
    statsErrorMessage,
    hotspotProfiles,
    hotspotProfilesLoading,
    hotspotProfilesErrorMessage,
    hotspotBindings,
    hotspotBindingsLoading,
    hotspotBindingsErrorMessage,
    hotspotUsers,
    hotspotUsersLoading,
    hotspotUsersErrorMessage,
    allPlans,
    plansWithProfileInfo,
    legacyTariffProfiles,
    availableHotspotProfileNames,
    fallbackHotspotProfileNames,
    totalTariffItems,
    filteredHotspotUsers,
    hotspotComplianceSummary,
    liveClients,
    maxBps,
    portalHref,
  };
}
