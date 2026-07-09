'use client';

import { Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { OperatorsHeroSection } from './operators-hero-section';
import { OperatorsFilterBar } from './operators-filter-bar';
import { OperatorsTableSection } from './operators-table-section';
import { OperatorProvisionModal } from './operator-provision-modal';
import { OperatorAssignTierModal } from './operator-assign-tier-modal';
import { OperatorTempPasswordModal } from './operator-temp-password-modal';
import { OperatorResetPasswordModal } from './operator-reset-password-modal';
import { OperatorSuspendModal } from './operator-suspend-modal';
import { useOperatorsPage } from './use-operators-page';

function OperatorsPageLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-44 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function OperatorsAccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--destructive)/0.1)]">
        <Users className="h-6 w-6 text-[hsl(var(--destructive))]" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold">Accès refusé</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Cette console est réservée aux Super Admins.
      </p>
    </div>
  );
}

export default function OperatorsPage() {
  const page = useOperatorsPage();

  if (page.isMeLoading) return <OperatorsPageLoading />;
  if (!page.isSuperAdmin) return <OperatorsAccessDenied />;

  return (
    <div className="space-y-6">
      <OperatorsHeroSection
        total={page.globalStats.total}
        active={page.globalStats.active}
        expiringSoon={page.globalStats.expiringSoon}
        revenueThisMonth={page.globalStats.revenueThisMonth}
        isLoading={page.isOpsLoading}
        canProvision={page.isSuperAdmin}
        onProvision={() => {
          page.setProvisionError(null);
          page.setShowProvision(true);
        }}
      />

      <OperatorsFilterBar
        search={page.search}
        tierFilter={page.tierFilter}
        statusFilter={page.statusFilter}
        tiers={page.tiers}
        resultCount={page.filteredOperators.length}
        onSearch={page.setSearch}
        onTierChange={page.setTierFilter}
        onStatusChange={page.setStatusFilter}
      />

      <OperatorsTableSection
        operators={page.filteredOperators}
        tiers={page.tiers}
        isLoading={page.isOpsLoading}
        isError={page.isOpsError}
        onRetry={() => void page.refetchOperators()}
        canManage={page.canManage}
        renewingId={page.renewingId}
        cancellingId={page.cancellingId}
        resettingPasswordId={page.resettingPasswordId}
        suspendingId={page.suspendingId}
        onAssign={(op) => {
          page.setAssignError(null);
          page.setAssignTarget(op);
        }}
        onRenew={(id) => page.renewMutation.mutate(id)}
        onCancel={(id) => page.cancelMutation.mutate(id)}
        onResetPassword={(op) => page.setResetPasswordTarget(op)}
        onSuspend={(op) => page.setSuspendTarget({ op, action: 'suspend' })}
        onUnsuspend={(op) => page.setSuspendTarget({ op, action: 'unsuspend' })}
      />

      {page.showProvision && (
        <OperatorProvisionModal
          tiers={page.tiers}
          isPending={page.provisionMutation.isPending}
          error={page.provisionError}
          onClose={() => {
            page.setShowProvision(false);
            page.setProvisionError(null);
          }}
          onSubmit={(data) => page.provisionMutation.mutate(data)}
        />
      )}

      {page.assignTarget && (
        <OperatorAssignTierModal
          operator={page.assignTarget}
          tiers={page.tiers}
          isPending={page.assignTierMutation.isPending}
          error={page.assignError}
          onClose={() => {
            page.setAssignTarget(null);
            page.setAssignError(null);
          }}
          onSubmit={(tierId, billingCycle) =>
            page.assignTierMutation.mutate({
              operatorId: page.assignTarget!.id,
              tierId,
              billingCycle,
            })
          }
        />
      )}

      {page.resetPasswordTarget && (
        <OperatorResetPasswordModal
          operator={page.resetPasswordTarget}
          isPending={page.resetPasswordMutation.isPending}
          onClose={() => page.setResetPasswordTarget(null)}
          onConfirm={() =>
            page.resetPasswordMutation.mutate(page.resetPasswordTarget!.id)
          }
        />
      )}

      {page.suspendTarget && (
        <OperatorSuspendModal
          operator={page.suspendTarget.op}
          action={page.suspendTarget.action}
          isPending={
            page.suspendMutation.isPending || page.activateMutation.isPending
          }
          onClose={() => page.setSuspendTarget(null)}
          onConfirm={() => {
            const id = page.suspendTarget!.op.id;
            if (page.suspendTarget!.action === 'suspend') {
              page.suspendMutation.mutate(id);
            } else {
              page.activateMutation.mutate(id);
            }
          }}
        />
      )}

      <OperatorTempPasswordModal
        open={page.tempPassword !== null}
        password={page.tempPassword?.password ?? null}
        email={page.tempPassword?.email ?? null}
        onClose={() => page.setTempPassword(null)}
      />
    </div>
  );
}
