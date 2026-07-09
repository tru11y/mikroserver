'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { IncidentSummaryRow } from './incident-summary-row';
import { IncidentTimestamp } from './incident-timestamp';
import type { IncidentSummary } from './incidents.types';

interface IncidentsSummaryPanelProps {
  summary: IncidentSummary;
  generatedAt: string;
  isLoading: boolean;
}

export function IncidentsSummaryPanel({
  summary,
  generatedAt,
  isLoading,
}: IncidentsSummaryPanelProps) {
  const id = 'summary-panel-heading';

  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border bg-card p-5 space-y-4"
    >
      <div>
        <h2 id={id} className="font-semibold">Vue rapide</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Mise à jour <IncidentTimestamp iso={generatedAt} />
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <IncidentSummaryRow label="Routeurs dégradés" value={summary.degradedRouters} highlight />
          <IncidentSummaryRow label="Erreurs de sync" value={summary.routersWithSyncErrors} highlight />
          <IncidentSummaryRow label="Utilisateurs non appariés" value={summary.routersWithUnmatchedUsers} highlight />
          <IncidentSummaryRow label="Backlog voucher queue" value={summary.voucherQueueBacklog} highlight />
          <IncidentSummaryRow label="Backlog webhook queue" value={summary.webhookQueueBacklog} highlight />
        </div>
      )}
    </section>
  );
}
