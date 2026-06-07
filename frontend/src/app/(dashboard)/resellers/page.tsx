'use client';

import { AlertCircle, Users } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ResellerAccessModal } from './reseller-access-modal';
import { ResellerCreateModal } from './reseller-create-modal';
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
      <h1 className="mt-4 text-xl font-semibold">Accès limité</h1>
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

  const deletingTarget = resellers.users.find((u) => u.id === resellers.deletingId);

  return (
    <div className="space-y-6">
      <ResellersHeroSection
        total={resellers.users.length}
        active={resellers.activeCount}
        suspended={resellers.suspendedCount}
        recent={resellers.recentlyActiveCount}
        canManageUsers={resellers.canManageUsers}
        onCreate={() => {
          resellers.setForm(emptyForm);
          resellers.setFormError(null);
          resellers.setShowForm(true);
        }}
      />

      {resellers.permissionOptionsErrorMessage ? (
        <div className="flex items-start gap-3 rounded-[24px] border border-warning/20 bg-warning/10 px-4 py-4 text-sm text-warning">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Profils d&apos;accès indisponibles</p>
            <p className="mt-1 text-warning/80">{resellers.permissionOptionsErrorMessage}</p>
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
        onRetry={resellers.refetchUsers}
        canManageUsers={resellers.canManageUsers}
        canDeleteUsers={resellers.canDeleteUsers}
        suspendingId={resellers.suspendingId}
        activatingId={resellers.activatingId}
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

      <ConfirmDialog
        open={Boolean(resellers.deletingId)}
        title="Supprimer ce compte"
        description={
          deletingTarget
            ? `Le compte de ${deletingTarget.firstName} ${deletingTarget.lastName} sera masqué du tableau de bord. Action réservée au Super Admin.`
            : 'Ce compte sera masqué du tableau de bord. Action réservée au Super Admin.'
        }
        confirmLabel="Supprimer"
        isLoading={resellers.deleteMutation.isPending}
        onCancel={() => resellers.setDeletingId(null)}
        onConfirm={() => {
          if (resellers.deletingId) {
            resellers.deleteMutation.mutate(resellers.deletingId);
          }
        }}
      />
    </div>
  );
}
