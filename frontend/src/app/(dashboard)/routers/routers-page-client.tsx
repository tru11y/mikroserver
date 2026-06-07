'use client';

import { useState } from 'react';
import { KpiCardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { Server } from 'lucide-react';
import { RouterDeleteModal } from './router-delete-modal';
import { RouterFormPanel } from './router-form-panel';
import { RoutersBulkActionsBar } from './routers-bulk-actions-bar';
import { RoutersFilterPanel } from './routers-filter-panel';
import { RoutersFleetSection } from './routers-fleet-section';
import { RoutersHeroSection } from './routers-hero-section';
import type { RouterItem } from './routers.types';
import { useRoutersPage } from './use-routers-page';

function RoutersPageLoading() {
  return (
    <div className="space-y-4">
      <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="h-12 animate-pulse rounded-lg border bg-muted/30" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg border bg-muted/30" />
        ))}
      </div>
    </div>
  );
}

export function RoutersPageClient() {
  const routers = useRoutersPage();
  const [deleteTarget, setDeleteTarget] = useState<RouterItem | null>(null);
  const isSuperAdmin = routers.currentUser?.role === 'SUPER_ADMIN';

  if (routers.isMeLoading) return <RoutersPageLoading />;

  if (!routers.canViewRouters) {
    return (
      <EmptyState
        icon={<Server className="h-5 w-5" />}
        title="Accès limité"
        description="Votre profil ne permet pas de consulter la flotte de routeurs."
      />
    );
  }

  return (
    <main className="space-y-4">
      <RoutersHeroSection
        summary={routers.summary}
        canManageRouters={routers.canManageRouters}
        isRefreshing={routers.isRefetching}
        onRefresh={() => { void routers.refetch(); }}
        onCreate={routers.openCreateForm}
        onFilterByStatus={routers.setStatusFilter}
      />

      <RoutersFilterPanel
        searchFilter={routers.searchFilter}
        statusFilter={routers.statusFilter}
        siteFilter={routers.siteFilter}
        tagFilter={routers.tagFilter}
        siteOptions={routers.siteOptions}
        tagOptions={routers.tagOptions}
        resultCount={routers.routers.length}
        hasActiveFilters={routers.hasActiveFilters}
        onSearchChange={routers.setSearchFilter}
        onStatusChange={routers.setStatusFilter}
        onSiteChange={routers.setSiteFilter}
        onTagChange={routers.setTagFilter}
      />

      <RoutersBulkActionsBar
        selectedCount={routers.selectedIds.length}
        selectedStatuses={routers.selectedStatuses}
        canRunHealthCheck={routers.canRunHealthCheck}
        canSyncRouters={routers.canSyncRouters}
        canManageRouters={routers.canManageRouters}
        isPending={routers.bulkMutation.isPending}
        onHealthCheck={() => routers.runBulkAction('HEALTH_CHECK')}
        onSync={() => routers.runBulkAction('SYNC')}
        onEnableMaintenance={() => routers.runBulkAction('ENABLE_MAINTENANCE')}
        onDisableMaintenance={() => routers.runBulkAction('DISABLE_MAINTENANCE')}
      />

      <RoutersFleetSection
        routers={routers.routers}
        isLoading={routers.isLoading}
        isRefetching={routers.isRefetching}
        errorMessage={routers.routersErrorMessage}
        selectedIds={routers.selectedIds}
        busyRouterId={routers.busyRouterId}
        canManageRouters={routers.canManageRouters}
        canRunHealthCheck={routers.canRunHealthCheck}
        canSyncRouters={routers.canSyncRouters}
        isRouteActionPending={routers.routerActionMutation.isPending}
        isDeletePending={routers.deleteMutation.isPending}
        onToggleSelection={routers.toggleSelection}
        onToggleSelectAll={routers.toggleSelectAll}
        onOpenEdit={routers.openEditForm}
        onAction={(payload) => routers.routerActionMutation.mutate(payload)}
        onDelete={setDeleteTarget}
        onRetry={() => { void routers.refetch(); }}
        onCreateRouter={routers.canManageRouters ? routers.openCreateForm : undefined}
      />

      <RouterFormPanel
        open={routers.isFormOpen && routers.canManageRouters}
        editingName={routers.editingRouter?.name}
        formState={routers.formState}
        setFormState={routers.setFormState}
        isPending={routers.saveMutation.isPending}
        onClose={routers.closeForm}
        onSubmit={routers.handleSubmit}
        isSuperAdmin={isSuperAdmin}
      />

      <RouterDeleteModal
        router={deleteTarget}
        isPending={routers.deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          routers.setBusyRouterId(deleteTarget.id);
          routers.deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
          });
        }}
      />
    </main>
  );
}
