'use client';

import { AlertCircle, Shield, Users } from 'lucide-react';
import { ResellerAccessModal } from './reseller-access-modal';
import { ResellerCreateModal } from './reseller-create-modal';
import { ResellerDeleteModal } from './reseller-delete-modal';
import { ResellerProfileModal } from './reseller-profile-modal';
import { ResellersDirectorySection } from './resellers-directory-section';
import { ResellersFilterBar } from './resellers-filter-bar';
import { ResellersHeroSection } from './resellers-hero-section';
import { useResellersPage } from './use-resellers-page';
import { emptyForm } from './resellers.utils';

function ResellersPageLoading() {
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

function ResellersAccessDenied() {
  return (
    <div className="rounded-[28px] border bg-card p-8 text-center">
      <Users className="mx-auto h-10 w-10 text-muted-foreground" />
      <h1 className="mt-4 text-xl font-semibold">Acces limite</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ton profil ne permet pas de consulter les comptes utilisateurs.
      </p>
    </div>
  );
}

export default function ResellersPage() {
  const resellers = useResellersPage();

  if (resellers.isMeLoading) {
    return <ResellersPageLoading />;
  }

  if (!resellers.canViewUsers) {
    return <ResellersAccessDenied />;
  }

  return (
    <div className="space-y-6">
      <ResellersHeroSection
        total={resellers.users.length}
        active={resellers.activeCount}
        recent={resellers.recentlyActiveCount}
        pending={resellers.pendingCount}
        canManageUsers={resellers.canManageUsers}
        onCreate={() => {
          resellers.setForm(emptyForm);
          resellers.setFormError(null);
          resellers.setShowForm(true);
        }}
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[24px] border bg-card/80 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Lecture produit
          </p>
          <h2 className="mt-2 text-lg font-semibold">Qui voit quoi, et pourquoi</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette zone doit rassurer un acheteur: recherche rapide, statut clair, roles
            lisibles et actions sensibles mieux encadrees.
          </p>
        </div>

        <div className="rounded-[24px] border bg-[linear-gradient(180deg,rgba(56,189,248,0.08),rgba(255,255,255,0.03))] p-5">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 text-sky-300" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">Garde-fous d&apos;exploitation</p>
              <p className="text-muted-foreground">
                {resellers.canManageUsers
                  ? "La gestion des acces est disponible. Les suppressions restent reservees au Super Admin."
                  : "Ton profil est actuellement limite a la consultation, ce qui protege les comptes deja en production."}
              </p>
              {!resellers.canDeleteUsers ? (
                <p className="text-xs text-muted-foreground">
                  Suppression definitive bloquee pour eviter les erreurs irreversibles.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {resellers.permissionOptionsErrorMessage ? (
        <div className="flex items-start gap-3 rounded-[24px] border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Profils d&apos;acces indisponibles</p>
            <p className="mt-1 text-amber-100/80">{resellers.permissionOptionsErrorMessage}</p>
          </div>
        </div>
      ) : null}

      <ResellersFilterBar
        roleFilter={resellers.roleFilter}
        statusFilter={resellers.statusFilter}
        searchFilter={resellers.searchFilter}
        resultCount={resellers.filteredUsers.length}
        onRoleChange={resellers.setRoleFilter}
        onStatusChange={resellers.setStatusFilter}
        onSearchChange={resellers.setSearchFilter}
      />

      <ResellersDirectorySection
        users={resellers.filteredUsers}
        isLoading={resellers.isLoading}
        errorMessage={resellers.usersErrorMessage}
        canManageUsers={resellers.canManageUsers}
        canDeleteUsers={resellers.canDeleteUsers}
        isSuspending={resellers.suspendMutation.isPending}
        isActivating={resellers.activateMutation.isPending}
        isDeleting={resellers.deleteMutation.isPending}
        onOpenProfile={resellers.openProfileModal}
        onOpenAccess={resellers.openAccessModal}
        onSuspend={(id) => resellers.suspendMutation.mutate(id)}
        onActivate={(id) => resellers.activateMutation.mutate(id)}
        onDelete={resellers.setDeletingId}
      />

      <ResellerCreateModal
        open={resellers.showForm}
        form={resellers.form}
        setForm={resellers.setForm}
        formError={resellers.formError}
        permissionOptions={resellers.permissionOptions}
        currentUserRole={resellers.currentUser?.role as string | undefined}
        defaultPermissionProfileByRole={resellers.defaultPermissionProfileByRole}
        isPending={resellers.createMutation.isPending}
        onClose={() => {
          resellers.setShowForm(false);
          resellers.setForm(emptyForm);
          resellers.setFormError(null);
        }}
        onSubmit={() => resellers.createMutation.mutate()}
      />

      <ResellerAccessModal
        reseller={resellers.accessTarget}
        accessProfile={resellers.accessProfile}
        accessPermissions={resellers.accessPermissions}
        accessError={resellers.accessError}
        permissionOptions={resellers.permissionOptions}
        isPending={resellers.updateAccessMutation.isPending}
        onClose={() => {
          resellers.setAccessTarget(null);
          resellers.setAccessError(null);
        }}
        onProfileChange={resellers.handleProfileChange}
        onTogglePermission={resellers.togglePermission}
        onSubmit={() => resellers.updateAccessMutation.mutate()}
      />

      <ResellerProfileModal
        reseller={resellers.profileTarget}
        form={resellers.profileForm}
        setForm={resellers.setProfileForm}
        profileError={resellers.profileError}
        passwordError={resellers.passwordError}
        passwordSuccess={resellers.passwordSuccess}
        isUpdatingProfile={resellers.updateProfileMutation.isPending}
        isResettingPassword={resellers.resetPasswordMutation.isPending}
        onClose={resellers.closeProfileModal}
        onSaveProfile={() => resellers.updateProfileMutation.mutate()}
        onResetPassword={() => resellers.resetPasswordMutation.mutate()}
      />

      <ResellerDeleteModal
        open={Boolean(resellers.deletingId)}
        isPending={resellers.deleteMutation.isPending}
        onClose={() => resellers.setDeletingId(null)}
        onConfirm={() => {
          if (resellers.deletingId) {
            resellers.deleteMutation.mutate(resellers.deletingId);
          }
        }}
      />
    </div>
  );
}
