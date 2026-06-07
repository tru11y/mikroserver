'use client';

import {
  Ban,
  ChevronDown,
  ChevronUp,
  Pencil,
  RefreshCw,
  ShieldOff,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, OfflineState } from '@/components/ui/states';
import type { LiveClientWithHotspotMeta } from './router-detail.selectors';
import type { HotspotUserRow } from './router-detail.types';
import { formatBytes, formatElapsedFromMinutes, parseRouterUptimeToSeconds } from './router-detail.utils';
import { ClientCardMobile } from './client-card-mobile';

interface ConnectedClientsSectionProps {
  isLoading: boolean;
  errorMessage: string | null;
  hasStats: boolean;
  clients: LiveClientWithHotspotMeta[];
  sortCol: 'username' | 'bytesIn' | 'bytesOut' | 'uptime';
  sortDir: 'asc' | 'desc';
  onToggleSort: (col: 'username' | 'bytesIn' | 'bytesOut' | 'uptime') => void;
  canManageHotspot: boolean;
  canTerminateSessions: boolean;
  canAdminDeleteTicket: boolean;
  disconnectingId: string | null;
  isProfileChangePending: boolean;
  isDisconnectPending: boolean;
  isDeletePending: boolean;
  isDisconnectExpiredPending?: boolean;
  onRetry?: () => void;
  onChangeProfile: (user: HotspotUserRow) => void;
  onDisconnect: (clientId: string) => void;
  onDelete: (username: string) => void;
  onDisconnectExpired?: () => void;
}

function ClientCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i}>
            <Skeleton className="mb-1 h-3 w-12" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConnectedClientsSection({
  isLoading,
  errorMessage,
  hasStats,
  clients,
  sortCol,
  sortDir,
  onToggleSort,
  canManageHotspot,
  canTerminateSessions,
  canAdminDeleteTicket,
  disconnectingId,
  isProfileChangePending,
  isDisconnectPending,
  isDeletePending,
  isDisconnectExpiredPending = false,
  onRetry,
  onChangeProfile,
  onDisconnect,
  onDelete,
  onDisconnectExpired,
}: ConnectedClientsSectionProps) {
  const expiredActiveCount = clients.filter(
    (c) => c.hotspotUser?.enforcementStatus === 'EXPIRED_BUT_ACTIVE',
  ).length;
  const unmatchedCount = clients.filter((c) => !c.hotspotUser).length;
  const isInitialLoading = isLoading && !hasStats;
  const cardProps = {
    canManageHotspot,
    canTerminateSessions,
    canAdminDeleteTicket,
    disconnectingId,
    isProfileChangePending,
    isDisconnectPending,
    isDeletePending,
    onChangeProfile,
    onDisconnect,
    onDelete,
  };

  return (
    <section
      id="section-panel-live"
      aria-labelledby="connected-clients-heading"
      className="rounded-xl border bg-card overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="connected-clients-heading" className="font-semibold">
            Clients connectés
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Actions rapides sur les sessions actives, mise à jour live toutes les 15 secondes
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {expiredActiveCount > 0 && canTerminateSessions && onDisconnectExpired && (
            <button
              type="button"
              onClick={onDisconnectExpired}
              disabled={isDisconnectExpiredPending}
              aria-label={`Purger ${expiredActiveCount} session(s) expirée(s)`}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive transition-all duration-200 ease-out hover:bg-destructive/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
            >
              {isDisconnectExpiredPending ? (
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldOff className="h-3 w-3" aria-hidden="true" />
              )}
              Purger expirés ({expiredActiveCount})
            </button>
          )}
          {unmatchedCount > 0 && (
            <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
              {unmatchedCount} non-appariés
            </span>
          )}
          {isLoading && hasStats && (
            <RefreshCw
              className="h-4 w-4 animate-spin text-muted-foreground"
              aria-hidden="true"
              aria-label="Actualisation en cours"
            />
          )}
        </div>
      </div>

      {/* Error state */}
      {errorMessage && !hasStats && (
        <ErrorState
          title="Impossible de charger les clients connectés"
          message={errorMessage}
          onRetry={onRetry}
          variant="inline"
          className="py-10"
        />
      )}

      {/* Initial loading — skeleton */}
      {isInitialLoading && !errorMessage && (
        <>
          {/* Mobile skeleton */}
          <div className="md:hidden space-y-3 p-4">
            <ClientCardSkeleton />
            <ClientCardSkeleton />
            <ClientCardSkeleton />
          </div>
          {/* Desktop skeleton */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <tbody>
                <TableRowSkeleton cols={6} />
                <TableRowSkeleton cols={6} />
                <TableRowSkeleton cols={6} />
                <TableRowSkeleton cols={6} />
                <TableRowSkeleton cols={6} />
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Empty states */}
      {!isInitialLoading && !errorMessage && hasStats && clients.length === 0 && (
        <div className="py-10">
          <EmptyState
            title="Aucun client connecté"
            description="Aucune session active sur ce hotspot pour le moment."
          />
        </div>
      )}

      {!isInitialLoading && !errorMessage && !hasStats && (
        <div className="py-10">
          <OfflineState />
        </div>
      )}

      {/* Data */}
      {!isInitialLoading && clients.length > 0 && (
        <>
          {/* Mobile — card list */}
          <div className="md:hidden space-y-3 p-4">
            {clients.map((client) => (
              <ClientCardMobile key={client.id} client={client} {...cardProps} />
            ))}
          </div>

          {/* Desktop — table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {[
                    { col: 'username' as const, label: 'Utilisateur' },
                    { col: null, label: 'IP / MAC' },
                    { col: null, label: 'Forfait / ancienneté' },
                    { col: 'uptime' as const, label: 'Durée' },
                    { col: 'bytesIn' as const, label: 'Download' },
                    { col: 'bytesOut' as const, label: 'Upload' },
                    ...(canManageHotspot || canTerminateSessions || canAdminDeleteTicket
                      ? [{ col: null, label: '' }]
                      : []),
                  ].map(({ col, label }) => (
                    <th
                      key={label || 'actions'}
                      onClick={() => col && onToggleSort(col)}
                      className={clsx(
                        'text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider',
                        col && 'cursor-pointer hover:text-foreground select-none',
                      )}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {col && sortCol === col && (
                          sortDir === 'desc' ? (
                            <ChevronDown className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <ChevronUp className="h-3 w-3" aria-hidden="true" />
                          )
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map((client) => {
                  const planLabel =
                    client.hotspotUser?.planName ?? client.hotspotUser?.profile;
                  return (
                    <tr
                      key={client.id}
                      className={clsx(
                        'transition-colors hover:bg-muted/20',
                        client.hotspotUser?.enforcementStatus ===
                          'EXPIRED_BUT_ACTIVE' && 'bg-destructive/5',
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                          </span>
                          <div>
                            <span className="font-medium font-mono text-xs">
                              {client.username}
                            </span>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {planLabel ?? 'Client non géré par MikroServer'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-xs">{client.ipAddress}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {client.macAddress}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        {planLabel && (
                          <p className="text-xs font-medium mb-1">{planLabel}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(
                            client.hotspotUser?.firstConnectionAt ??
                              client.connectedAt ??
                              Date.now() -
                                parseRouterUptimeToSeconds(client.uptime) * 1000,
                          ).toLocaleString('fr-FR')}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Écoulé :{' '}
                          {formatElapsedFromMinutes(
                            client.hotspotUser?.elapsedSinceFirstConnectionMinutes ??
                              Math.floor(
                                parseRouterUptimeToSeconds(client.uptime) / 60,
                              ),
                          )}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Expire :{' '}
                          {client.hotspotUser?.voucherExpiresAt
                            ? new Date(
                                client.hotspotUser.voucherExpiresAt,
                              ).toLocaleString('fr-FR')
                            : '-'}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs">{client.uptime}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-success">
                          {formatBytes(client.bytesIn)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-info">
                          {formatBytes(client.bytesOut)}
                        </span>
                      </td>
                      {(canManageHotspot ||
                        canTerminateSessions ||
                        canAdminDeleteTicket) && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {canManageHotspot && client.hotspotUser && (
                              <button
                                type="button"
                                onClick={() =>
                                  onChangeProfile(
                                    client.hotspotUser as HotspotUserRow,
                                  )
                                }
                                disabled={isProfileChangePending}
                                aria-label={`Changer le profil de ${client.username}`}
                                className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
                              >
                                <Pencil className="h-3 w-3" aria-hidden="true" />
                                Profil
                              </button>
                            )}
                            {canTerminateSessions && (
                              <button
                                type="button"
                                onClick={() => onDisconnect(client.id)}
                                disabled={isDisconnectPending}
                                aria-label={`Couper la session de ${client.username}`}
                                className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs text-destructive transition-all duration-200 ease-out hover:bg-destructive/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
                              >
                                <Ban className="h-3 w-3" aria-hidden="true" />
                                {disconnectingId === client.id
                                  ? 'Coupure...'
                                  : 'Couper'}
                              </button>
                            )}
                            {canAdminDeleteTicket && (
                              <button
                                type="button"
                                onClick={() => onDelete(client.username)}
                                disabled={isDeletePending}
                                aria-label={`Supprimer le ticket de ${client.username}`}
                                className="flex items-center gap-1.5 rounded-lg border border-warning/30 px-2.5 py-1.5 text-xs text-warning transition-all duration-200 ease-out hover:bg-warning/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
                              >
                                <Trash2 className="h-3 w-3" aria-hidden="true" />
                                {isDeletePending ? 'Suppression...' : 'Supprimer'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
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
