'use client';

import { useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  Activity,
  ExternalLink,
  Loader2,
  MapPin,
  MoreVertical,
  RefreshCcw,
  ShieldCheck,
  Users,
  WifiOff,
} from 'lucide-react';
import type { BulkAction, RouterItem } from './routers.types';
import { RouterContextMenu } from './router-context-menu';
import { RouterComplianceChip } from './router-compliance-chip';
import { RouterHealthAlert } from './router-health-alert';
import { RouterStatusBadge } from './router-status-badge';
import { RouterTagBadge } from './router-tag-badge';
import { RouterWgTunnelBadge } from './router-wg-tunnel-badge';
import { formatRelative } from './routers.utils';

export interface RouterCardHandlers {
  onToggleSelection: (id: string) => void;
  onOpenEdit: (router: RouterItem) => void;
  onAction: (args: { router: RouterItem; action: BulkAction }) => void;
  onDelete: (router: RouterItem) => void;
}

interface Props {
  router: RouterItem;
  isSelected: boolean;
  isBusy: boolean;
  canManageRouters: boolean;
  canRunHealthCheck: boolean;
  canSyncRouters: boolean;
  isRouteActionPending: boolean;
  isDeletePending: boolean;
  handlers: RouterCardHandlers;
}

export function RouterCardCompact({
  router,
  isSelected,
  isBusy,
  canManageRouters,
  canRunHealthCheck,
  canSyncRouters,
  isRouteActionPending,
  isDeletePending,
  handlers,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const failures = router.metadata?.consecutiveHealthFailures ?? 0;
  const hasWarning = failures >= 1 && router.status !== 'OFFLINE' && router.status !== 'MAINTENANCE';
  const visibleTags = router.tags.slice(0, 3);
  const extraTagCount = router.tags.length - visibleTags.length;
  const isOffline = router.status === 'OFFLINE';

  const actionBtnClass =
    'inline-flex items-center justify-center gap-1 rounded-md border bg-card px-2 py-1.5 text-xs hover:bg-muted/50 active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

  return (
    <article
      className={clsx(
        'group rounded-lg border bg-card p-3 transition-all duration-200 ease-out',
        isSelected
          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
          : isOffline
          ? 'border-destructive/20 hover:border-destructive/40 hover:shadow-[var(--shadow-md)]'
          : router.status === 'DEGRADED'
          ? 'border-warning/20 hover:border-warning/40 hover:shadow-[var(--shadow-md)]'
          : 'hover:border-primary/30 hover:shadow-[var(--shadow-md)]',
      )}
    >
      {/* Top row */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => handlers.onToggleSelection(router.id)}
          className="mt-1 h-3.5 w-3.5 rounded border-border cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          aria-label={`Sélectionner ${router.name}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/routers/${router.id}`}
              className="font-semibold text-sm leading-tight truncate hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] rounded-sm"
            >
              {router.name}
            </Link>
            <RouterStatusBadge status={router.status} />
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            {router.site && (
              <span className="inline-flex items-center gap-0.5 truncate">
                <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                {router.site}
              </span>
            )}
            <RouterWgTunnelBadge wireguardIp={router.wireguardIp} status={router.status} />
            <span className="font-mono text-[10px]">:{router.apiPort}</span>
          </div>
        </div>
      </div>

      {/* Credentials meta */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground mb-2">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" />
          {router.apiUsername}
        </span>
        <span className="text-muted-foreground/30" aria-hidden="true">·</span>
        <span className="truncate">{router.hotspotServer}/{router.hotspotProfile}</span>
      </div>

      {/* Offline duration (prominent) or clients + last seen */}
      {isOffline ? (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive mb-2">
          <WifiOff className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            Hors ligne {router.lastSeenAt ? `depuis ${formatRelative(router.lastSeenAt)}` : '— jamais vu'}
          </span>
        </div>
      ) : typeof router.metadata?.lastActiveClients === 'number' ? (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2">
          <Users className="h-3 w-3" aria-hidden="true" />
          <span className="font-semibold tabular-nums text-foreground">
            {router.metadata.lastActiveClients}
          </span>
          <span>client{router.metadata.lastActiveClients !== 1 ? 's' : ''}</span>
          <span className="text-muted-foreground/30" aria-hidden="true">·</span>
          <span>{formatRelative(router.lastSeenAt)}</span>
        </div>
      ) : null}

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {visibleTags.map((tag) => (
            <RouterTagBadge key={tag} tag={tag} />
          ))}
          {extraTagCount > 0 && (
            <span className="text-[10px] text-muted-foreground">+{extraTagCount}</span>
          )}
        </div>
      )}

      {/* Compliance chip */}
      <RouterComplianceChip router={router} />

      {/* Health warning */}
      {hasWarning && (
        <div className="mt-1.5 mb-2">
          <RouterHealthAlert
            failures={failures}
            lastError={router.metadata?.lastHealthCheckError}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3 pt-3 border-t">
        <Link
          href={`/routers/${router.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary/10 text-primary px-2 py-1.5 text-xs font-semibold hover:bg-primary/20 hover:shadow-[var(--shadow-glow)] active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          Détail
        </Link>

        {canRunHealthCheck && (
          <button
            type="button"
            onClick={() => handlers.onAction({ router, action: 'HEALTH_CHECK' })}
            disabled={isRouteActionPending && isBusy}
            className={actionBtnClass}
            title="Health-check"
            aria-label={`Health-check ${router.name}`}
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
            onClick={() => handlers.onAction({ router, action: 'SYNC' })}
            disabled={isRouteActionPending && isBusy}
            className={actionBtnClass}
            title="Synchroniser"
            aria-label={`Synchroniser ${router.name}`}
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
              onClick={() => setMenuOpen((v) => !v)}
              className={actionBtnClass}
              aria-label={`Plus d'actions pour ${router.name}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="h-3 w-3" />
            </button>
            {menuOpen && (
              <RouterContextMenu
                router={router}
                onEdit={() => { handlers.onOpenEdit(router); setMenuOpen(false); }}
                onToggleMaintenance={() => {
                  handlers.onAction({
                    router,
                    action: router.status === 'MAINTENANCE' ? 'DISABLE_MAINTENANCE' : 'ENABLE_MAINTENANCE',
                  });
                  setMenuOpen(false);
                }}
                onDelete={() => { handlers.onDelete(router); setMenuOpen(false); }}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    </article>
  );
}
