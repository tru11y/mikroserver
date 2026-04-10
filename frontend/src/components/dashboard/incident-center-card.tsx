'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AlertTriangle, ChevronRight, ShieldAlert, Siren, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';

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

const severityClasses = {
  CRITICAL: 'bg-red-500/10 text-red-300 border-red-500/20',
  HIGH: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  LOW: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
} as const;

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
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Centre d'incidents</h3>
          <p className="text-sm text-muted-foreground">
            Supervision routeurs, sync et livraison
          </p>
        </div>
        <Link
          href="/incidents"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Voir tout
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : !summary || summary.total === 0 ? (
        <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4" />
            Aucun incident critique detecte
          </div>
          <p className="mt-1 text-emerald-200/80">
            Les routeurs, la sync et les files d'attente semblent stables pour le moment.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Incidents ouverts</p>
              <p className="mt-1 text-2xl font-bold">{summary.total}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Critiques + hauts</p>
              <p className="mt-1 text-2xl font-bold text-red-300">
                {summary.critical + summary.high}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-300">
              {summary.offlineRouters} routeur(s) offline
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-300">
              {summary.deliveryFailures} echec(s) delivery
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-blue-300">
              {summary.voucherQueueBacklog} job(s) en attente
            </div>
          </div>

          <div className="space-y-2">
            {incidents.slice(0, 4).map((incident) => (
              <div key={incident.id} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {incident.severity === 'CRITICAL' ? (
                        <Siren className="h-4 w-4 text-red-300" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-300" />
                      )}
                      <p className="font-medium text-sm truncate">{incident.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {incident.description}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      severityClasses[incident.severity],
                    )}
                  >
                    {incident.severity}
                  </span>
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
    </div>
  );
}
