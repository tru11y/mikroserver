'use client';

import type { BulkAction, RouterItem } from './routers.types';
import { RouterCardCompact } from './router-card-compact';
import type { RouterCardHandlers } from './router-card-compact';

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

export function RoutersGridView({
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
  const handlers: RouterCardHandlers = {
    onToggleSelection,
    onOpenEdit,
    onAction,
    onDelete,
  };

  return (
    <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
      {routers.map((router) => (
        <RouterCardCompact
          key={router.id}
          router={router}
          isSelected={selectedIds.includes(router.id)}
          isBusy={busyRouterId === router.id}
          canManageRouters={canManageRouters}
          canRunHealthCheck={canRunHealthCheck}
          canSyncRouters={canSyncRouters}
          isRouteActionPending={isRouteActionPending}
          isDeletePending={isDeletePending}
          handlers={handlers}
        />
      ))}
    </div>
  );
}
