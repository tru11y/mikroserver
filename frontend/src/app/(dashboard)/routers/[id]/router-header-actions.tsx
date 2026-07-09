'use client';

import { Activity, Radio, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import type { RouterDetail } from './router-detail.types';

interface RouterHeaderActionsProps {
  routerInfo?: RouterDetail;
  dataUpdatedAt: number;
  canSyncRouters: boolean;
  canRunHealthCheck: boolean;
  isSyncPending: boolean;
  isChecking: boolean;
  onSync: () => void;
  onHealthCheck: () => void;
}

const btnBase =
  'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50';

export function RouterHeaderActions({
  routerInfo,
  dataUpdatedAt,
  canSyncRouters,
  canRunHealthCheck,
  isSyncPending,
  isChecking,
  onSync,
  onHealthCheck,
}: RouterHeaderActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {dataUpdatedAt > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Radio className="h-3 w-3 text-success" aria-hidden="true" />
          Live · {new Date(dataUpdatedAt).toLocaleTimeString('fr-FR')}
        </span>
      )}

      {canSyncRouters && (
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncPending}
          aria-label={isSyncPending ? 'Synchronisation en cours' : 'Synchroniser le routeur'}
          className={clsx(
            btnBase,
            !isSyncPending && 'hover:shadow-glow hover:border-primary/30',
          )}
        >
          <RefreshCw
            className={clsx('h-4 w-4', isSyncPending && 'animate-spin')}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">
            {isSyncPending ? 'Sync...' : 'Synchroniser'}
          </span>
        </button>
      )}

      {canRunHealthCheck && (
        <button
          type="button"
          onClick={onHealthCheck}
          disabled={isChecking}
          aria-label={isChecking ? 'Test API en cours' : 'Lancer un test API'}
          className={clsx(
            btnBase,
            !isChecking && 'hover:shadow-glow hover:border-primary/30',
          )}
        >
          <Activity
            className={clsx('h-4 w-4', isChecking && 'animate-spin')}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">
            {isChecking ? 'Test...' : 'Test API'}
          </span>
        </button>
      )}
    </div>
  );
}
