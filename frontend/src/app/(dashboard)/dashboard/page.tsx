'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { apiClient } from '@/lib/api/client';
import { customersApi } from '@/lib/api/customers';
import { DashboardOnboardingBanner } from './dashboard-onboarding-banner';
import { DashboardHeroSection } from './dashboard-hero-section';
import { DashboardRevenueSection } from './dashboard-revenue-section';
import { DashboardSessionsSection } from './dashboard-sessions-section';
import { DashboardInsightsSection } from './dashboard-insights-section';
import { RouterStatusPanel } from '@/components/dashboard/router-status-panel';
import { IncidentCenterCard } from '@/components/dashboard/incident-center-card';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: meData } = useQuery({
    queryKey: ['dashboard', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser   = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canViewReports = hasPermission(currentUser, 'reports.view');

  const {
    data: kpisResponse,
    isLoading,
    isError: isKpisError,
    refetch: refetchKpis,
  } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.metrics.dashboard(),
    refetchInterval: 30_000,
  });

  const {
    data: statsResponse,
    isError: isStatsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.metrics.dashboardStats(),
    refetchInterval: 30_000,
  });

  const { data: recommendationsData } = useQuery({
    queryKey: ['dashboard', 'daily-recommendations'],
    queryFn: () => api.metrics.dailyRecommendations(),
    enabled: canViewReports,
    staleTime: 60_000,
  });

  const { data: customerStatsData } = useQuery({
    queryKey: ['dashboard', 'customer-stats'],
    queryFn: async () => {
      const res = await customersApi.getStats();
      return (res.data as unknown as { data: { total: number; newThisWeek: number; activeThisWeek: number } }).data;
    },
    staleTime: 60_000,
  });

  const { data: liveData, isLoading: isLoadingLive } = useQuery({
    queryKey: ['dashboard', 'live-sessions'],
    queryFn: () => api.sessions.active(),
    refetchInterval: 10_000,
    staleTime: 0,
  });

  const { data: routersData } = useQuery({
    queryKey: ['routers-count'],
    queryFn: () => apiClient.get('/routers'),
    staleTime: 60_000,
  });

  const kpis        = kpisResponse?.data?.data;
  const stats       = statsResponse?.data?.data;
  const liveResult  = liveData?.data?.data;
  const liveCount   = liveResult?.items?.length ?? null;
  const routers     = (routersData?.data as { data: { id: string }[] } | undefined)?.data ?? null;
  const recommendations = recommendationsData
    ? (unwrap<{ items: { id: string; title: string; summary: string; actionLabel: string; actionPath: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }[] }>(recommendationsData).items ?? [])
    : [];

  const showOnboarding =
    routers !== null &&
    routers.length === 0 &&
    (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN');

  const routerOffline = kpis?.routers?.offline ?? 0;

  return (
    <div className="space-y-5">
      {showOnboarding && <DashboardOnboardingBanner />}

      {routerOffline > 0 && (
        <div role="alert" className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />
          <p className="text-xs flex-1">
            <span className="font-semibold">{routerOffline} routeur{routerOffline > 1 ? 's' : ''} hors ligne.</span>{' '}
            <span className="text-muted-foreground">Vérifiez la connectivité ou l&apos;alimentation.</span>
          </p>
          <Link
            href="/routers"
            className="text-xs font-semibold text-warning hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
          >
            Vérifier →
          </Link>
        </div>
      )}

      <DashboardHeroSection
        kpis={kpis}
        liveCount={liveCount}
        liveResult={liveResult}
        customerStats={customerStatsData}
        isLoading={isLoading}
        isLoadingLive={isLoadingLive}
        isError={isKpisError}
        onRetry={refetchKpis}
      />

      <DashboardRevenueSection
        topRouters={stats?.topRouters ?? []}
        isLoading={!statsResponse && !isStatsError}
        isError={isStatsError}
        onRetry={refetchStats}
      />

      <section aria-labelledby="network-heading" className="grid gap-4 lg:grid-cols-3">
        <h2 id="network-heading" className="sr-only">État du réseau</h2>
        <div className="lg:col-span-2">
          <RouterStatusPanel />
        </div>
        <IncidentCenterCard />
      </section>

      <DashboardSessionsSection
        sessions={stats?.recentSessions ?? []}
        liveCount={liveCount}
        liveResult={liveResult}
        isLoading={!statsResponse && !isStatsError}
        isError={isStatsError}
        onRetry={refetchStats}
      />

      {canViewReports && <DashboardInsightsSection recommendations={recommendations} />}
    </div>
  );
}
