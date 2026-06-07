'use client';

import { ArrowDown, ArrowUp, Clock, Loader2, Trash2, Ban, Wifi } from 'lucide-react';
import { clsx } from 'clsx';
import { SessionStatTile } from '@/components/ui/session-stat-tile';
import { formatBytes } from '@/lib/format';
import { formatConnectedAt, formatCountdown } from './sessions.utils';
import type { Session } from './use-sessions-page';

interface SessionCardMobileProps {
  session: Session;
  isTerminating: boolean;
  isDeleting: boolean;
  isExpiringSoon: boolean;
  canAdminDeleteTicket: boolean;
  onTerminate: () => void;
  onDeleteRequest: () => void;
}

export function SessionCardMobile({
  session: s,
  isTerminating,
  isDeleting,
  isExpiringSoon,
  canAdminDeleteTicket,
  onTerminate,
  onDeleteRequest,
}: SessionCardMobileProps) {
  return (
    <li
      className={clsx(
        'space-y-2 p-3',
        isExpiringSoon && 'border-l-2 border-warning',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="truncate font-mono text-xs font-bold tracking-wider">{s.username}</span>
        </div>
        <span className="flex flex-shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
          <Wifi className="h-2.5 w-2.5" aria-hidden="true" />
          <span className="max-w-24 truncate">{s.routerName ?? '—'}</span>
        </span>
      </div>

      {/* IP / MAC */}
      <div className="flex gap-3 font-mono text-[11px] text-muted-foreground">
        <span>{s.ipAddress}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="truncate">{s.macAddress}</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 pt-1">
        <SessionStatTile
          label="Uptime"
          value={s.uptime}
          icon={<Clock className="h-2.5 w-2.5" aria-hidden="true" />}
        />
        <SessionStatTile
          label="Expire"
          value={s.expiresAt ? formatCountdown(s.expiresAt) : '—'}
          tone={isExpiringSoon ? 'warning' : 'default'}
        />
        <SessionStatTile
          label="↓"
          value={formatBytes(s.bytesIn)}
          tone="success"
          icon={<ArrowDown className="h-2.5 w-2.5" aria-hidden="true" />}
        />
        <SessionStatTile
          label="↑"
          value={formatBytes(s.bytesOut)}
          tone="info"
          icon={<ArrowUp className="h-2.5 w-2.5" aria-hidden="true" />}
        />
      </div>

      {s.planName && (
        <p className="text-[10px] text-muted-foreground">
          Forfait : <span className="font-medium text-foreground">{s.planName}</span>
          {' · '}connecté {formatConnectedAt(s.connectedAt)}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onTerminate}
          disabled={isTerminating}
          aria-label={`Couper la session de ${s.username}`}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 text-xs font-semibold text-destructive transition-all duration-200 ease-out hover:bg-destructive/20 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {isTerminating
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            : <Ban className="h-3.5 w-3.5" aria-hidden="true" />}
          {isTerminating ? 'Coupure…' : 'Couper'}
        </button>
        {canAdminDeleteTicket && (
          <button
            type="button"
            onClick={onDeleteRequest}
            disabled={isDeleting}
            aria-label={`Supprimer le ticket de ${s.username}`}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-warning/30 bg-card px-3 text-xs font-medium text-warning transition-all duration-200 ease-out hover:bg-warning/10 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {isDeleting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        )}
      </div>
    </li>
  );
}
