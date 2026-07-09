'use client';

import { AlertTriangle, ArrowDown, ArrowUp, Ban, ChevronDown, ChevronUp, Loader2, RefreshCw, Trash2, Wifi } from 'lucide-react';
import { clsx } from 'clsx';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/lib/format';
import { SessionCardMobile } from './session-card-mobile';
import { formatConnectedAt, formatCountdown } from './sessions.utils';
import type { RouterError, Session, SortCol, SortDir } from './use-sessions-page';

interface SessionsTableSectionProps {
  sessions: Session[];
  routerErrors: RouterError[];
  routers: { id: string; name: string }[];
  routerId: string | undefined;
  onRouterChange: (id: string | undefined) => void;
  isLoading: boolean;
  isFetching: boolean;
  errorMessage: string | null;
  onRefetch: () => void;
  onTerminate: (session: Session) => void;
  onDeleteRequest: (session: Session) => void;
  canAdminDeleteTicket: boolean;
  terminatingId: string | null;
  deletingId: string | null;
  isTerminatePending: boolean;
  isDeletePending: boolean;
  isExpiringSoon: (iso: string | null) => boolean;
  sortCol: SortCol;
  sortDir: SortDir;
  onToggleSort: (col: SortCol) => void;
  respondingRouters: number;
  totalRouters: number;
}

function RouterErrorBanner({ errors }: { errors: RouterError[] }) {
  return (
    <div className="border-b border-warning/20 bg-warning/10 px-4 py-3" role="alert">
      <div className="flex items-start gap-2 text-xs text-warning">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold">Certains routeurs n&apos;ont pas répondu</p>
          {errors.map((re) => (
            <p key={re.routerId} className="truncate text-[11px]">
              {re.routerName} : {re.error}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

const DESKTOP_HEADERS: { col: SortCol | null; label: string }[] = [
  { col: null, label: 'Utilisateur' },
  { col: null, label: 'IP / MAC' },
  { col: null, label: 'Routeur' },
  { col: null, label: 'Connecté / Expire' },
  { col: 'uptime', label: 'Uptime' },
  { col: 'bytesIn', label: '↓ Down' },
  { col: 'bytesOut', label: '↑ Up' },
];

export function SessionsTableSection({
  sessions,
  routerErrors,
  routers,
  routerId,
  onRouterChange,
  isLoading,
  isFetching,
  errorMessage,
  onRefetch,
  onTerminate,
  onDeleteRequest,
  canAdminDeleteTicket,
  terminatingId,
  deletingId,
  isTerminatePending,
  isDeletePending,
  isExpiringSoon,
  sortCol,
  sortDir,
  onToggleSort,
  respondingRouters,
  totalRouters,
}: SessionsTableSectionProps) {
  const showPolling = isFetching && !isLoading;

  return (
    <section aria-labelledby="sessions-table-heading" className="rounded-xl border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="sessions-table-heading" className="text-sm font-semibold">
            Sessions en cours
          </h2>
          <p
            className="mt-0.5 text-[11px] text-muted-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            {isLoading
              ? 'Chargement…'
              : `${sessions.length} client${sessions.length !== 1 ? 's' : ''} · ${respondingRouters}/${totalRouters} routeur${totalRouters > 1 ? 's' : ''} joignable${respondingRouters > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showPolling && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground" aria-live="polite">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
              Actualisation…
            </span>
          )}
          {!showPolling && !isLoading && (
            <span className="flex items-center gap-1 text-[10px] text-success" aria-label="Polling actif">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Live
            </span>
          )}
          <select
            aria-label="Filtrer par routeur"
            value={routerId ?? ''}
            onChange={(e) => onRouterChange(e.target.value || undefined)}
            className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-none"
          >
            <option value="">Tous les routeurs</option>
            {routers.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onRefetch}
            disabled={isFetching}
            aria-label="Actualiser manuellement"
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ease-out hover:bg-muted/50 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <RefreshCw className={clsx('h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden="true" />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* Router errors */}
      {routerErrors.length > 0 && <RouterErrorBanner errors={routerErrors} />}

      {/* Error state */}
      {errorMessage && (
        <ErrorState
          title="Impossible de charger les sessions"
          message={errorMessage}
          onRetry={onRefetch}
          variant="inline"
          className="py-10"
        />
      )}

      {/* Loading skeleton */}
      {isLoading && !errorMessage && (
        <>
          <div className="md:hidden space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border bg-card/60 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-40" />
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-10 w-full rounded-md" />
                  ))}
                </div>
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <tbody>
                <TableRowSkeleton cols={8} />
                <TableRowSkeleton cols={8} />
                <TableRowSkeleton cols={8} />
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && !errorMessage && sessions.length === 0 && (
        <div className="py-10">
          <EmptyState
            title="Aucun client connecté"
            description="Les sessions hotspot actives apparaîtront ici."
          />
        </div>
      )}

      {/* Data */}
      {!isLoading && !errorMessage && sessions.length > 0 && (
        <>
          {/* Mobile cards */}
          <ul className="divide-y divide-border/50 md:hidden">
            {sessions.map((s) => (
              <SessionCardMobile
                key={s.id}
                session={s}
                isTerminating={terminatingId === s.id && isTerminatePending}
                isDeleting={deletingId === s.id && isDeletePending}
                isExpiringSoon={isExpiringSoon(s.expiresAt)}
                canAdminDeleteTicket={canAdminDeleteTicket}
                onTerminate={() => onTerminate(s)}
                onDeleteRequest={() => onDeleteRequest(s)}
              />
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {DESKTOP_HEADERS.map(({ col, label }) => {
                    let ariaSortValue: 'ascending' | 'descending' | 'none' | undefined;
                    if (col) {
                      ariaSortValue = sortCol === col
                        ? (sortDir === 'asc' ? 'ascending' : 'descending')
                        : 'none';
                    }
                    return (
                      <th
                        key={label}
                        onClick={() => col && onToggleSort(col)}
                        tabIndex={col ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (col && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onToggleSort(col);
                          }
                        }}
                        aria-sort={ariaSortValue}
                        className={clsx(
                          'px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground',
                          col && 'cursor-pointer select-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        )}
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          {col && sortCol === col && (
                            sortDir === 'desc'
                              ? <ChevronDown className="h-3 w-3" aria-hidden="true" />
                              : <ChevronUp className="h-3 w-3" aria-hidden="true" />
                          )}
                        </span>
                      </th>
                    );
                  })}
                  <th className="px-4 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sessions.map((s) => {
                  const expiringSoon = isExpiringSoon(s.expiresAt);
                  const isTerminating = terminatingId === s.id && isTerminatePending;
                  const isDeleting = deletingId === s.id && isDeletePending;
                  return (
                    <tr
                      key={s.id}
                      className={clsx(
                        'transition-colors hover:bg-muted/20',
                        expiringSoon && 'bg-warning/5',
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-1.5 w-1.5 flex-shrink-0" aria-hidden="true">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                          </span>
                          <span className="font-mono text-xs font-semibold">{s.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-mono text-xs">{s.ipAddress}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{s.macAddress}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Wifi className="h-3 w-3" aria-hidden="true" />
                          {s.routerName ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <p className="tabular-nums text-muted-foreground">{formatConnectedAt(s.connectedAt)}</p>
                        {s.expiresAt && (
                          <p className={clsx('tabular-nums', expiringSoon ? 'font-semibold text-warning' : 'text-muted-foreground')}>
                            {s.planName && <span className="font-medium text-foreground mr-1">{s.planName}</span>}
                            {formatCountdown(s.expiresAt)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums whitespace-nowrap">
                        {s.uptime}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-xs text-success tabular-nums">
                        {formatBytes(s.bytesIn)}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-xs text-info tabular-nums">
                        {formatBytes(s.bytesOut)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onTerminate(s)}
                            disabled={isTerminating}
                            aria-label={`Couper la session de ${s.username}`}
                            className="flex items-center gap-1 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-[11px] text-destructive transition-all duration-200 ease-out hover:bg-destructive/10 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            {isTerminating
                              ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                              : <Ban className="h-3 w-3" aria-hidden="true" />}
                            {isTerminating ? 'Coupure…' : 'Couper'}
                          </button>
                          {canAdminDeleteTicket && (
                            <button
                              type="button"
                              onClick={() => onDeleteRequest(s)}
                              disabled={isDeleting}
                              aria-label={`Supprimer le ticket de ${s.username}`}
                              className="flex items-center gap-1 rounded-lg border border-warning/30 px-2.5 py-1.5 text-[11px] text-warning transition-all duration-200 ease-out hover:bg-warning/10 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              {isDeleting
                                ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                : <Trash2 className="h-3 w-3" aria-hidden="true" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
