'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Loader2,
  MapPin,
  Server,
  Settings2,
  ShieldCheck,
  Tags,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import type { BulkAction, RouterItem } from './routers.types';
import { formatRelative, getStatusClasses, getStatusLabel } from './routers.utils';

function getStatusIcon(status: RouterItem['status']) {
  if (status === 'ONLINE') {
    return Wifi;
  }
  if (status === 'DEGRADED') {
    return AlertTriangle;
  }
  if (status === 'MAINTENANCE') {
    return Wrench;
  }
  return WifiOff;
}

interface RoutersFleetSectionProps {
  routers: RouterItem[];
  isLoading: boolean;
  errorMessage: string | null;
  selectedIds: string[];
  busyRouterId: string | null;
  canManageRouters: boolean;
  canRunHealthCheck: boolean;
  canSyncRouters: boolean;
  isRouteActionPending: boolean;
  isDeletePending: boolean;
  onToggleSelection: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenEdit: (router: RouterItem) => void;
  onAction: (args: { router: RouterItem; action: BulkAction }) => void;
  onDelete: (router: RouterItem) => void;
}

export function RoutersFleetSection({
  routers,
  isLoading,
  errorMessage,
  selectedIds,
  busyRouterId,
  canManageRouters,
  canRunHealthCheck,
  canSyncRouters,
  isRouteActionPending,
  isDeletePending,
  onToggleSelection,
  onToggleSelectAll,
  onOpenEdit,
  onAction,
  onDelete,
}: RoutersFleetSectionProps) {
  return (
    <section
      id="fleet"
      className="overflow-hidden rounded-[28px] border bg-card/95 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.85)]"
    >
      <div className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(56,189,248,0.08),rgba(255,255,255,0.01))] px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Flotte visible</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Chaque routeur expose son etat, son contexte terrain et ses actions critiques.
            </p>
          </div>

          {routers.length > 0 ? (
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={selectedIds.length > 0 && selectedIds.length === routers.length}
                onChange={onToggleSelectAll}
                className="h-4 w-4 rounded border-border"
              />
              Tout selectionner
            </label>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 p-6 xl:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-[24px] border border-white/10 bg-muted/20"
            />
          ))}
        </div>
      ) : errorMessage ? (
        <div className="p-10">
          <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Flotte indisponible</p>
              <p className="mt-1 text-red-100/80">{errorMessage}</p>
            </div>
          </div>
        </div>
      ) : routers.length === 0 ? (
        <div className="p-12 text-center">
          <Server className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Aucun routeur sur ce filtre</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajuste la recherche, le site, le tag ou le statut pour remonter les bonnes zones.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 p-4 lg:p-6 xl:grid-cols-2">
          {routers.map((router) => {
            const StatusIcon = getStatusIcon(router.status);
            const isSelected = selectedIds.includes(router.id);
            const isBusy = busyRouterId === router.id;

            return (
              <article
                key={router.id}
                className={clsx(
                  'group rounded-[24px] border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-36px_rgba(56,189,248,0.45)]',
                  isSelected
                    ? 'border-primary/35 bg-primary/10'
                    : 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]',
                )}
              >
                <div className="flex h-full flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelection(router.id)}
                        className="mt-1 h-4 w-4 rounded border-border"
                        aria-label={`Selectionner ${router.name}`}
                      />

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold tracking-tight">{router.name}</h3>
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                              getStatusClasses(router.status),
                            )}
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {getStatusLabel(router.status)}
                          </span>
                          {router.site ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-xs text-sky-100">
                              <MapPin className="h-3 w-3" />
                              {router.site}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Server className="h-3 w-3" />
                            {router.wireguardIp ?? '—'}:{router.apiPort}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            {router.apiUsername}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Settings2 className="h-3 w-3" />
                            {router.hotspotServer} · {router.hotspotProfile}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Derniere activite
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {formatRelative(router.lastSeenAt)}
                      </p>
                    </div>
                  </div>

                  {router.description ? (
                    <p className="text-sm text-muted-foreground">{router.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucun commentaire terrain n&apos;a encore ete saisi pour ce routeur.
                    </p>
                  )}

                  {typeof router.metadata?.lastActiveClients === 'number' && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span className="font-medium tabular-nums text-foreground">
                        {router.metadata.lastActiveClients}
                      </span>
                      <span>client(s) actif(s) lors de la derniere sync</span>
                    </div>
                  )}

                  {(router.metadata?.consecutiveHealthFailures ?? 0) >= 1 &&
                    router.status !== 'OFFLINE' &&
                    router.status !== 'MAINTENANCE' && (
                      <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-xs text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {router.metadata!.consecutiveHealthFailures} echec(s) recents — joignable
                        </span>
                      </div>
                    )}

                  <div className="flex flex-wrap items-center gap-2">
                    {router.location ? (
                      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {router.location}
                      </span>
                    ) : null}

                    {router.tags.length > 0 ? (
                      router.tags.map((tag) => (
                        <span
                          key={`${router.id}-${tag}`}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs text-primary"
                        >
                          <Tags className="h-3 w-3" />
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucun tag terrain</span>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
                    <Link
                      href={`/routers/${router.id}`}
                      className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors hover:bg-white/5"
                    >
                      Ouvrir le detail
                    </Link>

                    <div className="flex flex-wrap justify-end gap-2">
                      {canRunHealthCheck ? (
                        <button
                          type="button"
                          onClick={() => onAction({ router, action: 'HEALTH_CHECK' })}
                          disabled={isRouteActionPending && isBusy}
                          className="rounded-full border px-3 py-2 text-sm transition-colors hover:bg-white/5 disabled:opacity-60"
                        >
                          {isRouteActionPending && isBusy ? 'Test...' : 'Tester'}
                        </button>
                      ) : null}
                      {canSyncRouters ? (
                        <button
                          type="button"
                          onClick={() => onAction({ router, action: 'SYNC' })}
                          disabled={isRouteActionPending && isBusy}
                          className="rounded-full border px-3 py-2 text-sm transition-colors hover:bg-white/5 disabled:opacity-60"
                        >
                          {isRouteActionPending && isBusy ? 'Sync...' : 'Sync'}
                        </button>
                      ) : null}
                      {canManageRouters ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenEdit(router)}
                            className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors hover:bg-white/5"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onAction({
                                router,
                                action:
                                  router.status === 'MAINTENANCE'
                                    ? 'DISABLE_MAINTENANCE'
                                    : 'ENABLE_MAINTENANCE',
                              })
                            }
                            disabled={isRouteActionPending && isBusy}
                            className="rounded-full border px-3 py-2 text-sm transition-colors hover:bg-white/5 disabled:opacity-60"
                          >
                            {router.status === 'MAINTENANCE'
                              ? 'Sortir maintenance'
                              : 'Maintenance'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(router)}
                            disabled={isDeletePending && isBusy}
                            className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100 transition-colors hover:bg-red-400/20 disabled:opacity-60"
                          >
                            {isDeletePending && isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Supprimer
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
