'use client';

import { useState } from 'react';
import { AlertTriangle, Server } from 'lucide-react';
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
      <div className="h-40 animate-pulse rounded-[28px] border bg-card/70" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-2xl border bg-card/70" />
        ))}
      </div>
    </div>
  );
}

function RoutersAccessDenied() {
  return (
    <div className="rounded-[28px] border bg-card p-8 text-center">
      <Server className="mx-auto h-10 w-10 text-muted-foreground" />
      <h1 className="mt-4 text-xl font-semibold">Acces limite</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ton profil ne permet pas de consulter la flotte de routeurs.
      </p>
    </div>
  );
}

export default function RoutersPage() {
  const routers = useRoutersPage();
  const [deleteTarget, setDeleteTarget] = useState<RouterItem | null>(null);
  const isSuperAdmin = routers.currentUser?.role === 'SUPER_ADMIN';

  if (routers.isMeLoading) {
    return <RoutersPageLoading />;
  }

  if (!routers.canViewRouters) {
    return <RoutersAccessDenied />;
  }

  return (
    <div className="space-y-6">
      <RoutersHeroSection
        summary={routers.summary}
        canManageRouters={routers.canManageRouters}
        isRefreshing={routers.isRefetching}
        onRefresh={() => {
          void routers.refetch();
        }}
        onCreate={routers.openCreateForm}
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[24px] border bg-card/80 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Lecture commerciale
          </p>
          <h2 className="mt-2 text-lg font-semibold">Un parc qui inspire confiance</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Chaque carte doit permettre de comprendre l&apos;etat d&apos;un site, le
            contexte technique et le prochain geste operateur sans effort inutile.
          </p>
        </div>

        <div className="rounded-[24px] border bg-[linear-gradient(180deg,rgba(245,158,11,0.1),rgba(255,255,255,0.03))] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">Note d&apos;exploitation</p>
              <p className="text-muted-foreground">
                Les sites et tags restent legers en base pour conserver la velocite du produit,
                mais l&apos;experience de lecture doit deja sembler premium.
              </p>
              <p className="text-xs text-muted-foreground">
                Health check, sync et maintenance sont exposes plus proprement pour reduire les
                erreurs terrain.
              </p>
            </div>
          </div>
        </div>
      </div>

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
        canRunHealthCheck={routers.canRunHealthCheck}
        canSyncRouters={routers.canSyncRouters}
        canManageRouters={routers.canManageRouters}
        isPending={routers.bulkMutation.isPending}
        onHealthCheck={() => routers.runBulkAction('HEALTH_CHECK')}
        onSync={() => routers.runBulkAction('SYNC')}
        onEnableMaintenance={() => routers.runBulkAction('ENABLE_MAINTENANCE')}
        onDisableMaintenance={() => routers.runBulkAction('DISABLE_MAINTENANCE')}
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

      <RoutersFleetSection
        routers={routers.routers}
        isLoading={routers.isLoading}
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
      />

      <RouterDeleteModal
        router={deleteTarget}
        isPending={routers.deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }
          routers.setBusyRouterId(deleteTarget.id);
          routers.deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
          });
        }}
      />
    </div>
  );
}
