'use client';

import { RefreshCw, Siren } from 'lucide-react';
import { clsx } from 'clsx';
import { IncidentTimestamp } from './incident-timestamp';
import { IncidentKpiCard } from './incident-kpi-card';
import type { IncidentSummary } from './incidents.types';

interface IncidentsHeroSectionProps {
  summary: IncidentSummary;
  generatedAt: string;
  isFetching: boolean;
  onRefresh: () => void;
}

export function IncidentsHeroSection({
  summary,
  generatedAt,
  isFetching,
  onRefresh,
}: IncidentsHeroSectionProps) {
  return (
    <header className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-tight">Centre d'incidents</h1>
            {summary.total > 0 && (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                {summary.total}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Routeurs, synchronisation, delivery et files d'attente
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:block">
            Mis à jour <IncidentTimestamp iso={generatedAt} />
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            aria-disabled={isFetching ? 'true' : 'false'}
            aria-label="Rafraîchir les incidents"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <RefreshCw
              className={clsx('h-3.5 w-3.5', isFetching && 'animate-spin')}
              aria-hidden="true"
            />
            <span className="hidden sm:block">Rafraîchir</span>
          </button>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        role="region"
        aria-label="Résumé des incidents"
      >
        <IncidentKpiCard label="Critiques" value={summary.critical} tone="destructive" />
        <IncidentKpiCard label="Haute priorité" value={summary.high} tone="warning" />
        <IncidentKpiCard label="Routeurs hors ligne" value={summary.offlineRouters} tone="info" />
        <IncidentKpiCard label="Delivery en échec" value={summary.deliveryFailures} tone="primary" />
      </div>
    </header>
  );
}
