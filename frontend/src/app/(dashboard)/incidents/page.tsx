'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import {
  AlertTriangle,
  Clock3,
  ShieldCheck,
  Siren,
  WifiOff,
  Workflow,
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  entityType: 'router' | 'voucher' | 'queue' | 'system';
  entityId?: string;
  routerId?: string;
  routerName?: string;
  metadata?: Record<string, unknown>;
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

function getIncidentIcon(type: string, severity: IncidentItem['severity']) {
  if (type === 'QUEUE_BACKLOG') {
    return <Workflow className="h-4 w-4 text-blue-300" />;
  }

  if (severity === 'CRITICAL') {
    return <Siren className="h-4 w-4 text-red-300" />;
  }

  return <AlertTriangle className="h-4 w-4 text-amber-300" />;
}

function formatRelative(date: string) {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: fr,
  });
}

export default function IncidentsPage() {
  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canViewReports = hasPermission(currentUser, 'reports.view');

  const { data, isLoading } = useQuery({
    queryKey: ['metrics', 'incidents'],
    queryFn: () => api.metrics.incidents(),
    refetchInterval: 30_000,
    enabled: canViewReports,
  });

  const incidentCenter = (data?.data?.data as IncidentCenterResponse | undefined) ?? null;
  const summary = incidentCenter?.summary;
  const incidents = useMemo<IncidentItem[]>(
    () => incidentCenter?.incidents ?? [],
    [incidentCenter],
  );

  const grouped = useMemo(
    () => ({
      critical: incidents.filter((incident) => incident.severity === 'CRITICAL'),
      high: incidents.filter((incident) => incident.severity === 'HIGH'),
      medium: incidents.filter((incident) => incident.severity === 'MEDIUM'),
      low: incidents.filter((incident) => incident.severity === 'LOW'),
    }),
    [incidents],
  );

  if (isMeLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canViewReports) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <Siren className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Acces limite</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ton profil ne permet pas de consulter le centre d&apos;incidents.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Centre d'incidents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Routeurs, synchronisation, delivery et files d'attente
        </p>
      </div>

      {!summary || summary.total === 0 ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5">
          <div className="flex items-center gap-2 text-emerald-300 font-medium">
            <ShieldCheck className="h-5 w-5" />
            Aucun incident ouvert
          </div>
          <p className="text-sm text-emerald-200/80 mt-2">
            La supervision ne remonte actuellement ni routeur offline, ni echec de sync, ni backlog significatif.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Critiques',
                value: summary.critical,
                tone: 'text-red-300 border-red-500/20 bg-red-500/10',
              },
              {
                label: 'Haute priorite',
                value: summary.high,
                tone: 'text-amber-300 border-amber-500/20 bg-amber-500/10',
              },
              {
                label: 'Routeurs offline',
                value: summary.offlineRouters,
                tone: 'text-blue-300 border-blue-500/20 bg-blue-500/10',
              },
              {
                label: 'Delivery en echec',
                value: summary.deliveryFailures,
                tone: 'text-violet-300 border-violet-500/20 bg-violet-500/10',
              },
            ].map((card) => (
              <div key={card.label} className={clsx('rounded-xl border p-4', card.tone)}>
                <p className="text-xs uppercase tracking-wider opacity-80">{card.label}</p>
                <p className="mt-2 text-3xl font-bold">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_2fr]">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div>
                <h2 className="font-semibold">Vue rapide</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Mise a jour {incidentCenter ? formatRelative(incidentCenter.generatedAt) : 'maintenant'}
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Routeurs en degrade</span>
                  <span>{summary.degradedRouters}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Erreurs de sync</span>
                  <span>{summary.routersWithSyncErrors}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Utilisateurs non apparies</span>
                  <span>{summary.routersWithUnmatchedUsers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Backlog voucher queue</span>
                  <span>{summary.voucherQueueBacklog}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Backlog webhook queue</span>
                  <span>{summary.webhookQueueBacklog}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold">Incidents ouverts</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Classes par severite, du plus critique au plus faible
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {summary.total} incident(s)
                </div>
              </div>

              <div className="space-y-5">
                {(['critical', 'high', 'medium', 'low'] as const).map((key) => {
                  const items = grouped[key];
                  if (!items.length) {
                    return null;
                  }

                  const titleMap = {
                    critical: 'Critique',
                    high: 'Haute',
                    medium: 'Moyenne',
                    low: 'Faible',
                  } as const;

                  return (
                    <section key={key} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                            severityClasses[key.toUpperCase() as IncidentItem['severity']],
                          )}
                        >
                          {titleMap[key]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {items.length} incident(s)
                        </span>
                      </div>

                      {items.map((incident) => (
                        <article key={incident.id} className="rounded-lg border bg-muted/20 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {getIncidentIcon(incident.type, incident.severity)}
                                <h3 className="font-medium">{incident.title}</h3>
                              </div>
                              <p className="text-sm text-muted-foreground mt-2">
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

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3 w-3" />
                              {formatRelative(incident.detectedAt)}
                            </span>
                            {incident.routerName && (
                              <span className="inline-flex items-center gap-1">
                                <WifiOff className="h-3 w-3" />
                                {incident.routerName}
                              </span>
                            )}
                            {incident.type === 'QUEUE_BACKLOG' && incident.entityId && (
                              <span>File: {incident.entityId}</span>
                            )}
                          </div>
                        </article>
                      ))}
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
