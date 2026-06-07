'use client';

import { useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MoreVertical,
  RefreshCcw,
} from 'lucide-react';
import type { BulkAction, RouterItem } from './routers.types';
import { RouterComplianceChip } from './router-compliance-chip';
import { RouterContextMenu } from './router-context-menu';
import { RouterStatusDot } from './router-status-dot';
import { formatRelative, getStatusLabel } from './routers.utils';

interface Props {
  routers: RouterItem[];
  selectedIds: string[];
  busyRouterId: string | null;
  canManageRouters: boolean;
  canRunHealthCheck: boolean;
  canSyncRouters: boolean;
  isRouteActionPending: boolean;
  isDeletePending: boolean;
  onToggleSelection: (id: string) => void;
  onOpenEdit: (router: RouterItem) => void;
  onAction: (args: { router: RouterItem; action: BulkAction }) => void;
  onDelete: (router: RouterItem) => void;
}

export function RoutersTableView({
  routers,
  selectedIds,
  busyRouterId,
  canManageRouters,
  canRunHealthCheck,
  canSyncRouters,
  isRouteActionPending,
  isDeletePending,
  onToggleSelection,
  onOpenEdit,
  onAction,
  onDelete,
}: Props) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const btnClass =
    'p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Liste des routeurs">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="w-8 px-3 py-2"><span className="sr-only">Sélection</span></th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Nom</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Statut</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest hidden sm:table-cell">Site</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">IP WG</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Clients</th>
            <th className="px-3 py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-widest hidden lg:table-cell">Santé</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest hidden xl:table-cell">Dernière vue</th>
            <th className="px-3 py-2 w-10"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {routers.map((r) => {
            const isSelected = selectedIds.includes(r.id);
            const isBusy = busyRouterId === r.id;
            const failures = r.metadata?.consecutiveHealthFailures ?? 0;
            const healthError = r.metadata?.lastHealthCheckError;

            return (
              <tr
                key={r.id}
                className={clsx(
                  'hover:bg-muted/20 transition-colors group',
                  isSelected && 'bg-primary/5',
                )}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelection(r.id)}
                    className="h-3.5 w-3.5 rounded border-border cursor-pointer focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                    aria-label={`Sélectionner ${r.name}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/routers/${r.id}`}
                      className="font-semibold text-sm hover:text-primary transition-colors inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] rounded-sm"
                    >
                      {r.name}
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                    </Link>
                    <RouterComplianceChip router={r} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <RouterStatusDot status={r.status} />
                    <span className="text-xs">{getStatusLabel(r.status)}</span>
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">
                  {r.site ?? '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground hidden md:table-cell">
                  {r.wireguardIp ?? '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {typeof r.metadata?.lastActiveClients === 'number' ? r.metadata.lastActiveClients : '—'}
                </td>
                <td className="px-3 py-2 text-center hidden lg:table-cell">
                  {failures === 0 ? (
                    <span className="inline-flex items-center justify-center text-success" aria-label="Santé OK">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">Aucun échec</span>
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-0.5 text-xs text-warning cursor-default"
                      title={healthError ?? `${failures} échec(s) consécutif(s)`}
                      aria-label={`${failures} échec${failures > 1 ? 's' : ''} health-check consécutif${failures > 1 ? 's' : ''}`}
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      <span>{failures}</span>
                      <span className="sr-only">échec{failures > 1 ? 's' : ''} health-check</span>
                    </span>
                  )}
                </td>
                <td className={clsx(
                  'px-3 py-2 text-xs hidden xl:table-cell',
                  r.status === 'OFFLINE' ? 'font-semibold text-destructive' : 'text-muted-foreground',
                )}>
                  {formatRelative(r.lastSeenAt)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-0.5 justify-end">
                    {canRunHealthCheck && (
                      <button
                        type="button"
                        onClick={() => onAction({ router: r, action: 'HEALTH_CHECK' })}
                        disabled={isRouteActionPending && isBusy}
                        className={btnClass}
                        title="Health-check"
                        aria-label={`Health-check ${r.name}`}
                      >
                        {isRouteActionPending && isBusy ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <Activity className="h-3 w-3" />
                        )}
                      </button>
                    )}
                    {canSyncRouters && (
                      <button
                        type="button"
                        onClick={() => onAction({ router: r, action: 'SYNC' })}
                        disabled={isRouteActionPending && isBusy}
                        className={btnClass}
                        title="Synchroniser"
                        aria-label={`Synchroniser ${r.name}`}
                      >
                        {isRouteActionPending && isBusy ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <RefreshCcw className="h-3 w-3" />
                        )}
                      </button>
                    )}
                    {canManageRouters && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuOpenId(menuOpenId === r.id ? null : r.id)}
                          className={btnClass}
                          aria-label={`Plus d'actions pour ${r.name}`}
                          aria-haspopup="menu"
                          aria-expanded={menuOpenId === r.id ? true : undefined}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </button>
                        {menuOpenId === r.id && (
                          <RouterContextMenu
                            router={r}
                            onEdit={() => { onOpenEdit(r); setMenuOpenId(null); }}
                            onToggleMaintenance={() => {
                              onAction({
                                router: r,
                                action: r.status === 'MAINTENANCE' ? 'DISABLE_MAINTENANCE' : 'ENABLE_MAINTENANCE',
                              });
                              setMenuOpenId(null);
                            }}
                            onDelete={() => { onDelete(r); setMenuOpenId(null); }}
                            onClose={() => setMenuOpenId(null)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
