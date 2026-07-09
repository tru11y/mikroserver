'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChevronRight, ShieldCheck, Siren, AlertTriangle, WifiOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SeverityBadge } from '@/components/ui/priority-badge';

interface IncidentSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  offlineRouters: number;
  degradedRouters: number;
  routersWithSyncErrors: number;
  routersWithUnmatchedUsers: number;
  deliveryFailures: number;
  voucherQueueBacklog: number;
  webhookQueueBacklog: number;
}

interface IncidentItem {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  title: string;
  description: string;
  detectedAt: string;
  routerName?: string;
}

interface IncidentCenterResponse {
  summary: IncidentSummary;
  incidents: IncidentItem[];
  generatedAt: string;
}

export function IncidentCenterCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['metrics', 'incidents'],
    queryFn: () => api.metrics.incidents(),
    refetchInterval: 30_000,
  });

  const incidentCenter = (data?.data?.data as IncidentCenterResponse | undefined) ?? null;
  const summary = incidentCenter?.summary;
  const incidents = incidentCenter?.incidents ?? [];

  return (
    <section aria-labelledby="incidents-heading" className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="incidents-heading" className="font-semibold">Centre d&apos;incidents</h3>
          <p className="text-sm text-muted-foreground">Routeurs, sync, livraison</p>
        </div>
        <Link
          href="/incidents"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] rounded"
        >
          Voir tout
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : !summary || summary.total === 0 ? (
        <div className="mt-6 rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4" />
            Aucun incident critique détecté
          </div>
          <p className="mt-1 text-success/80 text-xs">
            Routeurs, sync et files d&apos;attente stables.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Incidents ouverts</p>
              <p className="mt-1 text-2xl font-bold">{summary.total}</p>
            </div>
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-xs text-muted-foreground">Critiques + hauts</p>
              <p className="mt-1 text-2xl font-bold text-destructive">
                {summary.critical + summary.high}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">
              {summary.offlineRouters} offline
            </div>
            <div className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-warning">
              {summary.deliveryFailures} échecs
            </div>
            <div className="rounded-lg border border-info/20 bg-info/10 px-3 py-2 text-info">
              {summary.voucherQueueBacklog} en file
            </div>
          </div>

          <div className="space-y-2">
            {incidents.slice(0, 4).map((incident) => (
              <div key={incident.id} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {incident.severity === 'CRITICAL' ? (
                        <Siren className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                      )}
                      <p className="font-medium text-sm truncate">{incident.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {incident.description}
                    </p>
                  </div>
                  <SeverityBadge severity={incident.severity} />
                </div>
                {incident.routerName && (
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <WifiOff className="h-3 w-3" />
                    {incident.routerName}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
