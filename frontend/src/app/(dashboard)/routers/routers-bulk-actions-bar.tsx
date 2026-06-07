'use client';

import { useState } from 'react';
import { Activity, Loader2, RefreshCw, Wrench } from 'lucide-react';
import { clsx } from 'clsx';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { RouterStatus } from './routers.types';

interface RoutersBulkActionsBarProps {
  selectedCount: number;
  selectedStatuses: RouterStatus[];
  canRunHealthCheck: boolean;
  canSyncRouters: boolean;
  canManageRouters: boolean;
  isPending: boolean;
  onHealthCheck: () => void;
  onSync: () => void;
  onEnableMaintenance: () => void;
  onDisableMaintenance: () => void;
}

type PendingBulkAction = 'maintenance' | null;

export function RoutersBulkActionsBar({
  selectedCount,
  selectedStatuses,
  canRunHealthCheck,
  canSyncRouters,
  canManageRouters,
  isPending,
  onHealthCheck,
  onSync,
  onEnableMaintenance,
  onDisableMaintenance,
}: RoutersBulkActionsBarProps) {
  const [confirmAction, setConfirmAction] = useState<PendingBulkAction>(null);

  if (selectedCount === 0) return null;

  // Derive intent from selection: majority in maintenance → exit, otherwise → enter
  const maintenanceCount = selectedStatuses.filter((s) => s === 'MAINTENANCE').length;
  const exitMaintenance = maintenanceCount === selectedCount;

  const handleConfirm = () => {
    if (exitMaintenance) onDisableMaintenance();
    else onEnableMaintenance();
    setConfirmAction(null);
  };

  const btnClass = (primary?: boolean) =>
    clsx(
      'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      primary
        ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[var(--shadow-glow)]'
        : 'border bg-card hover:bg-muted/50',
    );

  const icon = (node: React.ReactNode) =>
    isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : node;

  return (
    <>
      <section
        aria-live="polite"
        aria-label={`${selectedCount} routeur${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''}`}
        className="sticky top-0 z-20 rounded-lg border border-primary/30 bg-primary/5 backdrop-blur-sm p-3"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold tabular-nums">
              {selectedCount}
            </span>
            <p className="text-xs font-medium">
              routeur{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {canRunHealthCheck && (
              <button type="button" onClick={onHealthCheck} disabled={isPending} className={btnClass(true)}>
                {icon(<Activity className="h-3.5 w-3.5" aria-hidden="true" />)}
                Health-check
              </button>
            )}
            {canSyncRouters && (
              <button type="button" onClick={onSync} disabled={isPending} className={btnClass()}>
                {icon(<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />)}
                Synchroniser
              </button>
            )}
            {canManageRouters && (
              <button
                type="button"
                onClick={() => setConfirmAction('maintenance')}
                disabled={isPending}
                className={btnClass()}
                aria-label={exitMaintenance ? 'Sortir les routeurs sélectionnés de maintenance' : 'Passer les routeurs sélectionnés en maintenance'}
              >
                {icon(<Wrench className="h-3.5 w-3.5" aria-hidden="true" />)}
                {exitMaintenance ? 'Sortir maintenance' : 'Maintenance'}
                {maintenanceCount > 0 && maintenanceCount < selectedCount && (
                  <span className="ml-0.5 opacity-60 text-[10px]">({maintenanceCount}/{selectedCount})</span>
                )}
              </button>
            )}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmAction !== null}
        title={
          exitMaintenance
            ? `Sortir ${selectedCount} routeur${selectedCount > 1 ? 's' : ''} de maintenance ?`
            : `Passer ${selectedCount} routeur${selectedCount > 1 ? 's' : ''} en maintenance ?`
        }
        description={
          exitMaintenance
            ? 'Ces routeurs reprendront le traitement des connexions.'
            : 'Ces routeurs ne traiteront plus de connexions pendant la maintenance.'
        }
        confirmLabel={exitMaintenance ? 'Sortir de maintenance' : 'Passer en maintenance'}
        isLoading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
