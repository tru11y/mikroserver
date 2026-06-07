'use client';

import { useState } from 'react';
import { LayoutGrid, List, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import type { BulkAction, RouterItem } from './routers.types';
import { RoutersGridView } from './routers-grid-view';
import { RoutersTableView } from './routers-table-view';

const SECTION_ID = 'routers-fleet-heading';

type ViewMode = 'grid' | 'table';

interface Props {
  routers: RouterItem[];
  isLoading: boolean;
  isRefetching?: boolean;
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
  onRetry: () => void;
  onCreateRouter?: () => void;
}

export function RoutersFleetSection({
  routers,
  isLoading,
  isRefetching,
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
  onRetry,
  onCreateRouter,
}: Props) {
  const [view, setView] = useState<ViewMode>('grid');
  const allSelected = routers.length > 0 && selectedIds.length === routers.length;

  const toggleBtnClass = (active: boolean) =>
    clsx(
      'p-1 rounded active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background',
      active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    );

  return (
    <section aria-labelledby={SECTION_ID} className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          {routers.length > 0 && (
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="h-3.5 w-3.5 rounded border-border cursor-pointer focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                aria-label="Tout sélectionner"
              />
              <span className="hidden sm:inline">Tout</span>
            </label>
          )}
          <h2 id={SECTION_ID} className="text-sm font-semibold">Flotte</h2>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest tabular-nums">
            {routers.length}
          </span>
          {isRefetching && (
            <Loader2
              className="h-3.5 w-3.5 animate-spin text-muted-foreground"
              aria-label="Actualisation en cours"
            />
          )}
        </div>

        {/* View toggle — hidden on mobile, force grid */}
        <div className="hidden sm:flex items-center gap-0.5 rounded-md border bg-background p-0.5">
          <button
            type="button"
            onClick={() => setView('grid')}
            className={toggleBtnClass(view === 'grid')}
            aria-label="Vue grille"
            aria-current={view === 'grid' ? 'true' : undefined}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={toggleBtnClass(view === 'table')}
            aria-label="Vue tableau"
            aria-current={view === 'table' ? 'true' : undefined}
          >
            <List className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : errorMessage ? (
        <div className="p-6">
          <ErrorState message={errorMessage} onRetry={onRetry} />
        </div>
      ) : routers.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="Aucun routeur"
            description="Aucun routeur ne correspond aux filtres sélectionnés."
            action={
              canManageRouters && onCreateRouter ? (
                <button
                  type="button"
                  onClick={onCreateRouter}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 hover:shadow-[var(--shadow-glow)] active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Ajouter un routeur
                </button>
              ) : undefined
            }
          />
        </div>
      ) : view === 'table' ? (
        <RoutersTableView
          routers={routers}
          selectedIds={selectedIds}
          busyRouterId={busyRouterId}
          canManageRouters={canManageRouters}
          canRunHealthCheck={canRunHealthCheck}
          canSyncRouters={canSyncRouters}
          isRouteActionPending={isRouteActionPending}
          isDeletePending={isDeletePending}
          onToggleSelection={onToggleSelection}
          onOpenEdit={onOpenEdit}
          onAction={onAction}
          onDelete={onDelete}
        />
      ) : (
        <RoutersGridView
          routers={routers}
          selectedIds={selectedIds}
          busyRouterId={busyRouterId}
          canManageRouters={canManageRouters}
          canRunHealthCheck={canRunHealthCheck}
          canSyncRouters={canSyncRouters}
          isRouteActionPending={isRouteActionPending}
          isDeletePending={isDeletePending}
          onToggleSelection={onToggleSelection}
          onOpenEdit={onOpenEdit}
          onAction={onAction}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}
