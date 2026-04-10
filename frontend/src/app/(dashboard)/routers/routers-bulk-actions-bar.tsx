'use client';

import { Activity, RefreshCw, Wrench } from 'lucide-react';

interface RoutersBulkActionsBarProps {
  selectedCount: number;
  canRunHealthCheck: boolean;
  canSyncRouters: boolean;
  canManageRouters: boolean;
  isPending: boolean;
  onHealthCheck: () => void;
  onSync: () => void;
  onEnableMaintenance: () => void;
  onDisableMaintenance: () => void;
}

export function RoutersBulkActionsBar({
  selectedCount,
  canRunHealthCheck,
  canSyncRouters,
  canManageRouters,
  isPending,
  onHealthCheck,
  onSync,
  onEnableMaintenance,
  onDisableMaintenance,
}: RoutersBulkActionsBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <section className="rounded-[24px] border border-primary/20 bg-[linear-gradient(135deg,rgba(56,189,248,0.12),rgba(255,255,255,0.03))] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium">{selectedCount} routeur(s) selectionne(s)</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Operations groupees pour le terrain, avec une hierarchie plus claire que
            l&apos;ancien bloc d&apos;actions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canRunHealthCheck ? (
            <button
              type="button"
              onClick={onHealthCheck}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors hover:bg-white/5 disabled:opacity-60"
            >
              <Activity className="h-4 w-4" />
              Health check
            </button>
          ) : null}
          {canSyncRouters ? (
            <button
              type="button"
              onClick={onSync}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors hover:bg-white/5 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              Synchroniser
            </button>
          ) : null}
          {canManageRouters ? (
            <>
              <button
                type="button"
                onClick={onEnableMaintenance}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors hover:bg-white/5 disabled:opacity-60"
              >
                <Wrench className="h-4 w-4" />
                Passer en maintenance
              </button>
              <button
                type="button"
                onClick={onDisableMaintenance}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors hover:bg-white/5 disabled:opacity-60"
              >
                <Wrench className="h-4 w-4" />
                Retirer maintenance
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
