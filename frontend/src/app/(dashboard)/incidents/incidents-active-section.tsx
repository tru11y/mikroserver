'use client';

import { ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { IncidentCard } from './incident-card';
import { IncidentSeverityBadge } from './incident-severity-badge';
import type { GroupedIncidents, IncidentSeverity } from './incidents.types';

const SEVERITY_KEYS = ['critical', 'high', 'medium', 'low'] as const;
type SeverityKey = (typeof SEVERITY_KEYS)[number];

const KEY_TO_SEVERITY: Record<SeverityKey, IncidentSeverity> = {
  critical: 'CRITICAL',
  high:     'HIGH',
  medium:   'MEDIUM',
  low:      'LOW',
};

const SEVERITY_ARIA_LABEL: Record<SeverityKey, string> = {
  critical: 'Incidents critiques',
  high:     'Incidents de haute priorité',
  medium:   'Incidents de priorité moyenne',
  low:      'Incidents de faible priorité',
};

interface IncidentsActiveSectionProps {
  grouped: GroupedIncidents;
  total: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-l-4 border-l-border bg-muted/20 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function IncidentsActiveSection({
  grouped,
  total,
  isLoading,
  isError,
  onRetry,
}: IncidentsActiveSectionProps) {
  const sectionId = 'incidents-active-heading';

  return (
    <section aria-labelledby={sectionId} className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 id={sectionId} className="font-semibold">Incidents ouverts</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Classés par sévérité, du plus critique au plus faible
          </p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{total} incident(s)</span>
      </div>

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <ErrorState
          title="Impossible de charger les incidents"
          message="Une erreur est survenue lors de la récupération des données."
          onRetry={onRetry}
          variant="inline"
        />
      )}

      {!isLoading && !isError && total === 0 && (
        <div className="flex items-center gap-2 text-success text-sm py-4">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Aucun incident actif</span>
        </div>
      )}

      {!isLoading && !isError && total > 0 && (
        <div className="space-y-6">
          {SEVERITY_KEYS.map((key) => {
            const items = grouped[key];
            if (!items.length) return null;
            const severity = KEY_TO_SEVERITY[key];

            return (
              <section key={key} aria-label={SEVERITY_ARIA_LABEL[key]}>
                <div className="flex items-center gap-2 mb-3">
                  <IncidentSeverityBadge severity={severity} />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {items.length} incident(s)
                  </span>
                </div>
                <div className="space-y-2.5">
                  {items.map((incident) => (
                    <IncidentCard key={incident.id} incident={incident} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
