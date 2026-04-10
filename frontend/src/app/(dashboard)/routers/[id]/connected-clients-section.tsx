import {
  Ban,
  ChevronDown,
  ChevronUp,
  Pencil,
  RefreshCw,
  ShieldOff,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { LiveClientWithHotspotMeta } from './router-detail.selectors';
import type { HotspotUserRow } from './router-detail.types';
import { formatBytes, formatElapsedFromMinutes } from './router-detail.utils';

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
  onChangeProfile: (user: HotspotUserRow) => void;
  onDisconnect: (clientId: string) => void;
  onDelete: (username: string) => void;
  onDisconnectExpired?: () => void;
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
  onChangeProfile,
  onDisconnect,
  onDelete,
  onDisconnectExpired,
}: ConnectedClientsSectionProps) {
  const expiredActiveCount = clients.filter(
    (c) => c.hotspotUser?.enforcementStatus === 'EXPIRED_BUT_ACTIVE',
  ).length;
  const unmatchedCount = clients.filter((c) => !c.hotspotUser).length;
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Clients connectés</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Actions rapides sur les sessions actives, avec mise a jour live toutes les 15 secondes
          </p>
          {errorMessage && (
            <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Impossible de charger les stats live: {errorMessage}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {expiredActiveCount > 0 && canTerminateSessions && onDisconnectExpired && (
            <button
              onClick={onDisconnectExpired}
              disabled={isDisconnectExpiredPending}
              className="flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-400/20 disabled:opacity-50"
            >
              {isDisconnectExpiredPending ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <ShieldOff className="h-3 w-3" />
              )}
              Purger expirés ({expiredActiveCount})
            </button>
          )}
          {unmatchedCount > 0 && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">
              {unmatchedCount} non-appariés
            </span>
          )}
          {isLoading && (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {!hasStats || clients.length === 0 ? (
        <div className="py-12 text-center">
          <WifiOff className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? 'Chargement...'
              : hasStats
                ? 'Aucun client connecté'
                : 'Routeur hors ligne ou inaccessible'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {[
                  { col: 'username' as const, label: 'Utilisateur' },
                  { col: null, label: 'IP / MAC' },
                  { col: null, label: 'Forfait / anciennete' },
                  { col: 'uptime' as const, label: 'Durée' },
                  { col: 'bytesIn' as const, label: 'Download' },
                  { col: 'bytesOut' as const, label: 'Upload' },
                  ...(canManageHotspot || canTerminateSessions || canAdminDeleteTicket
                    ? [{ col: null, label: '' }]
                    : []),
                ].map(({ col, label }) => (
                  <th
                    key={label}
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
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronUp className="h-3 w-3" />
                        )
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className={clsx(
                    'transition-colors hover:bg-muted/20',
                    client.hotspotUser?.enforcementStatus === 'EXPIRED_BUT_ACTIVE' &&
                      'bg-red-500/5',
                  )}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                      <div>
                        <span className="font-medium font-mono text-xs">
                          {client.username}
                        </span>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {client.hotspotUser?.planName ??
                            client.hotspotUser?.profile ??
                            'Client non gere par MikroServer'}
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
                    <p className="text-xs">
                      {client.hotspotUser?.firstConnectionAt
                        ? new Date(client.hotspotUser.firstConnectionAt).toLocaleString(
                            'fr-FR',
                          )
                        : '-'}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Ecoule:{' '}
                      {formatElapsedFromMinutes(
                        client.hotspotUser?.elapsedSinceFirstConnectionMinutes,
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Expire:{' '}
                      {client.hotspotUser?.voucherExpiresAt
                        ? new Date(client.hotspotUser.voucherExpiresAt).toLocaleString(
                            'fr-FR',
                          )
                        : '-'}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs">{client.uptime}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-emerald-400 font-medium">
                      {formatBytes(client.bytesIn)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-blue-400 font-medium">
                      {formatBytes(client.bytesOut)}
                    </span>
                  </td>
                  {(canManageHotspot || canTerminateSessions || canAdminDeleteTicket) && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {canManageHotspot && client.hotspotUser && (
                          <button
                            onClick={() => onChangeProfile(client.hotspotUser as HotspotUserRow)}
                            disabled={isProfileChangePending}
                            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
                          >
                            <Pencil className="h-3 w-3" />
                            {isProfileChangePending ? 'Profil...' : 'Profil'}
                          </button>
                        )}
                        {canTerminateSessions && (
                          <button
                            onClick={() => onDisconnect(client.id)}
                            disabled={isDisconnectPending}
                            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50"
                          >
                            <Ban className="h-3 w-3" />
                            {disconnectingId === client.id ? 'Coupure...' : 'Couper'}
                          </button>
                        )}
                        {canAdminDeleteTicket && (
                          <button
                            onClick={() => onDelete(client.username)}
                            disabled={isDeletePending}
                            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-amber-300 transition-colors hover:bg-amber-400/10 disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            {isDeletePending ? 'Suppression...' : 'Supprimer'}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
