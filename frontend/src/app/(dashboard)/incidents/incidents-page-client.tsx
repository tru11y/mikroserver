'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Siren } from 'lucide-react';
import { KpiCardSkeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import type { IncidentCenterResponse, GroupedIncidents } from './incidents.types';
import { IncidentsHeroSection } from './incidents-hero-section';
import { IncidentsSummaryPanel } from './incidents-summary-panel';
import { IncidentsActiveSection } from './incidents-active-section';
import { IncidentsAllClearBanner } from './incidents-all-clear-banner';

function PageLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement en cours">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-6 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-l-4 border-l-border bg-muted/20 p-4 space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="rounded-xl border bg-card p-8 text-center" role="alert">
      <Siren className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold">Accès limité</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ton profil ne permet pas de consulter le centre d&apos;incidents.
      </p>
    </div>
  );
}

export function IncidentsPageClient() {
  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const currentUser = meData ? unwrap<{ role?: string; permissions?: string[] }>(meData) : null;
  const canViewReports = hasPermission(currentUser, 'reports.view');

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['metrics', 'incidents'],
    queryFn: () => api.metrics.incidents(),
    refetchInterval: 30_000,
    enabled: canViewReports,
  });

  const incidentCenter = useMemo<IncidentCenterResponse | null>(() => {
    if (!data?.data?.data) return null;
    return data.data.data as IncidentCenterResponse;
  }, [data]);

  const grouped = useMemo<GroupedIncidents>(() => {
    const incidents = incidentCenter?.incidents ?? [];
    return {
      critical: incidents.filter((i) => i.severity === 'CRITICAL'),
      high:     incidents.filter((i) => i.severity === 'HIGH'),
      medium:   incidents.filter((i) => i.severity === 'MEDIUM'),
      low:      incidents.filter((i) => i.severity === 'LOW'),
    };
  }, [incidentCenter]);

  if (isMeLoading) return <PageLoading />;
  if (!canViewReports) return <AccessDenied />;
  if (isLoading && !incidentCenter) return <PageLoading />;

  if (isError && !incidentCenter) {
    return (
      <ErrorState
        title="Impossible de charger les incidents"
        message="Une erreur est survenue lors de la récupération des données."
        onRetry={() => refetch()}
      />
    );
  }

  const summary = incidentCenter!.summary;
  const generatedAt = incidentCenter!.generatedAt;
  const total = summary.total;

  return (
    <main className="space-y-5">
      <IncidentsHeroSection
        summary={summary}
        generatedAt={generatedAt}
        isFetching={isFetching}
        onRefresh={() => refetch()}
      />

      {total === 0 ? (
        <IncidentsAllClearBanner generatedAt={generatedAt} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <IncidentsSummaryPanel
            summary={summary}
            generatedAt={generatedAt}
            isLoading={false}
          />
          <IncidentsActiveSection
            grouped={grouped}
            total={total}
            isLoading={false}
            isError={isError}
            onRetry={() => refetch()}
          />
        </div>
      )}
    </main>
  );
}
