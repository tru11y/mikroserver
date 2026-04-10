'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';

interface SessionHistoryItem {
  id: string;
  status: string;
  macAddress: string | null;
  ipAddress: string | null;
  bytesIn: string | number;
  bytesOut: string | number;
  startedAt: string;
  lastSeenAt: string | null;
  terminatedAt: string | null;
  terminateReason: string | null;
  durationMinutes: number;
  planDurationMinutes: number | null;
  remainingMinutes: number | null;
  isOverdue: boolean;
  router: { id: string; name: string };
  voucher: {
    code: string;
    status: string;
    activatedAt: string | null;
    expiresAt: string | null;
    generationType: string;
    plan: { name: string; durationMinutes: number } | null;
  } | null;
}

interface HistoryResponse {
  items: SessionHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

function formatBytes(val: string | number): string {
  const bytes = Number(val);
  if (!bytes || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Actif', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  DISCONNECTED: { label: 'Déconnecté', cls: 'text-muted-foreground bg-muted/50 border-border' },
  TERMINATED: { label: 'Coupé', cls: 'text-amber-300 bg-amber-400/10 border-amber-400/20' },
  EXPIRED: { label: 'Expiré', cls: 'text-red-400 bg-red-400/10 border-red-400/20' },
};

interface RouterHistorySectionProps {
  routerId: string;
}

export function RouterHistorySection({ routerId }: RouterHistorySectionProps) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const LIMIT = 25;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sessions-history', routerId, page, statusFilter, fromDate, toDate],
    queryFn: () =>
      api.sessions.history({
        routerId,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate ? `${toDate}T23:59:59` : undefined,
        page,
        limit: LIMIT,
      }),
    staleTime: 30_000,
  });

  const result = data?.data?.data as HistoryResponse | undefined;
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  // Group by day
  const byDay = items.reduce<Map<string, SessionHistoryItem[]>>((acc, item) => {
    const day = new Date(item.startedAt).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    if (!acc.has(day)) acc.set(day, []);
    acc.get(day)!.push(item);
    return acc;
  }, new Map());

  const overdueCount = items.filter((i) => i.isOverdue).length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Statut</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm"
            >
              <option value="">Tous</option>
              <option value="ACTIVE">Actifs</option>
              <option value="DISCONNECTED">Déconnectés</option>
              <option value="TERMINATED">Coupés</option>
              <option value="EXPIRED">Expirés</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Du</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Au</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          {(statusFilter || fromDate || toDate) && (
            <button
              onClick={() => { setStatusFilter(''); setFromDate(''); setToDate(''); setPage(1); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Réinitialiser
            </button>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {total} session(s)
          </div>
        </div>
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs text-red-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{overdueCount} session(s)</strong> avec un ticket expiré sont encore actives.
            Utilisez <em>Purger expirés</em> dans l&apos;onglet Clients connectés.
          </span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : isError ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Impossible de charger l&apos;historique.
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <WifiOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucune session trouvée pour ces filtres.</p>
          </div>
        ) : (
          <div>
            {Array.from(byDay.entries()).map(([day, daySessions]) => (
              <div key={day}>
                <div className="px-5 py-2 bg-muted/30 border-b text-xs font-medium text-muted-foreground capitalize">
                  {day} — {daySessions.length} session(s)
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {daySessions.map((s) => {
                      const statusMeta = STATUS_LABELS[s.status] ?? STATUS_LABELS.DISCONNECTED;
                      const usedPct =
                        s.planDurationMinutes
                          ? Math.min(100, Math.round((s.durationMinutes / s.planDurationMinutes) * 100))
                          : null;

                      return (
                        <tr
                          key={s.id}
                          className={clsx(
                            'hover:bg-muted/20 transition-colors',
                            s.isOverdue && 'bg-red-500/5',
                          )}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              {s.isOverdue && (
                                <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                              )}
                              <div>
                                <p className="font-mono text-xs font-medium">
                                  {s.voucher?.code ?? '—'}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {s.voucher?.plan?.name ?? 'Forfait inconnu'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs">{s.macAddress ?? '—'}</p>
                            <p className="text-[11px] text-muted-foreground">{s.ipAddress ?? ''}</p>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <p>{formatDate(s.startedAt)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {s.terminatedAt
                                ? `→ ${formatDate(s.terminatedAt)}`
                                : s.lastSeenAt
                                  ? `vu: ${formatDate(s.lastSeenAt)}`
                                  : ''}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">{formatDuration(s.durationMinutes)}</span>
                            </div>
                            {usedPct !== null && (
                              <div className="mt-1.5 h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={clsx(
                                    'h-full rounded-full transition-all',
                                    usedPct >= 100 ? 'bg-red-400' : usedPct >= 80 ? 'bg-amber-400' : 'bg-emerald-400',
                                  )}
                                  style={{ width: `${usedPct}%` }}
                                />
                              </div>
                            )}
                            {s.planDurationMinutes && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                / {formatDuration(s.planDurationMinutes)}
                                {s.remainingMinutes !== null && (
                                  <span className={clsx('ml-1', s.remainingMinutes <= 0 ? 'text-red-400' : 'text-emerald-400')}>
                                    ({s.remainingMinutes <= 0 ? 'épuisé' : `−${formatDuration(s.remainingMinutes)}`})
                                  </span>
                                )}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <p className="text-emerald-400">{formatBytes(s.bytesIn)} ↓</p>
                            <p className="text-blue-400">{formatBytes(s.bytesOut)} ↑</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={clsx('rounded-full border px-2 py-0.5 text-[11px]', statusMeta.cls)}>
                              {statusMeta.label}
                            </span>
                            {s.terminateReason && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{s.terminateReason}</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {page} / {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-3 w-3" /> Préc.
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 hover:bg-muted disabled:opacity-40"
            >
              Suiv. <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
