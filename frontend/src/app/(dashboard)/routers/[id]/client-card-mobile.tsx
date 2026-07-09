'use client';

import { Ban, Pencil, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { EnforcementBadge } from '@/components/ui/enforcement-badge';
import type { LiveClientWithHotspotMeta } from './router-detail.selectors';
import type { HotspotUserRow } from './router-detail.types';
import { formatBytes } from './router-detail.utils';

interface ClientCardMobileProps {
  client: LiveClientWithHotspotMeta;
  canManageHotspot: boolean;
  canTerminateSessions: boolean;
  canAdminDeleteTicket: boolean;
  disconnectingId: string | null;
  isProfileChangePending: boolean;
  isDisconnectPending: boolean;
  isDeletePending: boolean;
  onChangeProfile: (user: HotspotUserRow) => void;
  onDisconnect: (clientId: string) => void;
  onDelete: (username: string) => void;
}

const btnBase =
  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50';

export function ClientCardMobile({
  client,
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
}: ClientCardMobileProps) {
  const planLabel = client.hotspotUser?.planName ?? client.hotspotUser?.profile;
  const isExpired = client.hotspotUser?.enforcementStatus === 'EXPIRED_BUT_ACTIVE';
  const hasActions = canManageHotspot || canTerminateSessions || canAdminDeleteTicket;

  return (
    <div
      className={clsx(
        'rounded-xl border bg-card p-4',
        isExpired && 'border-destructive/30 bg-destructive/5',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {/* Ping dot pour client actif */}
          <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="truncate font-mono text-sm font-medium">{client.username}</span>
        </div>
        {client.hotspotUser?.enforcementStatus && (
          <EnforcementBadge status={client.hotspotUser.enforcementStatus} />
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <p className="text-muted-foreground">IP</p>
          <p className="font-mono">{client.ipAddress}</p>
        </div>
        <div>
          <p className="text-muted-foreground">MAC</p>
          <p className="font-mono text-[11px]">{client.macAddress}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Durée</p>
          <p>{client.uptime}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Forfait</p>
          <p className={planLabel ? undefined : 'text-muted-foreground'}>
            {planLabel ?? 'Non géré'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Download</p>
          <p className="font-medium text-success">{formatBytes(client.bytesIn)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Upload</p>
          <p className="font-medium text-info">{formatBytes(client.bytesOut)}</p>
        </div>
        {client.hotspotUser?.voucherExpiresAt && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Expiration</p>
            <p>{new Date(client.hotspotUser.voucherExpiresAt).toLocaleString('fr-FR')}</p>
          </div>
        )}
      </div>

      {hasActions && (
        <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
          {canManageHotspot && client.hotspotUser && (
            <button
              type="button"
              onClick={() => onChangeProfile(client.hotspotUser as HotspotUserRow)}
              disabled={isProfileChangePending}
              aria-label={`Changer le profil de ${client.username}`}
              className={clsx(btnBase, 'hover:bg-muted')}
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
              className={clsx(
                btnBase,
                'border-destructive/30 text-destructive hover:bg-destructive/10',
              )}
            >
              <Ban className="h-3 w-3" aria-hidden="true" />
              {disconnectingId === client.id ? 'Coupure...' : 'Couper'}
            </button>
          )}
          {canAdminDeleteTicket && (
            <button
              type="button"
              onClick={() => onDelete(client.username)}
              disabled={isDeletePending}
              aria-label={`Supprimer le ticket de ${client.username}`}
              className={clsx(
                btnBase,
                'border-warning/30 text-warning hover:bg-warning/10',
              )}
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
