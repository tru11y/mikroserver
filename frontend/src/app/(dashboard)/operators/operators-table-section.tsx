'use client';

import { clsx } from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, Users } from 'lucide-react';
import { TierBadge } from '@/components/ui/tier-badge';
import { SubscriptionStatusBadge } from '@/components/ui/subscription-status-badge';
import { RoleBadge } from '@/components/ui/role-badge';
import { OperatorAvatar } from '@/components/ui/operator-avatar';
import { RouterUsageBar } from '@/components/ui/router-usage-bar';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { OperatorActionsMenu } from './operator-actions-menu';
import { isExpiringSoon } from './use-operators-page';
import { formatXof } from '@/lib/formatters';
import type { Operator, SaasTier } from '@/lib/api/admin';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return format(new Date(iso), 'd MMM yyyy', { locale: fr });
}

function MobileCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

interface OperatorsTableSectionProps {
  operators: Operator[];
  tiers: SaasTier[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  canManage: boolean;
  renewingId: string | null;
  cancellingId: string | null;
  resettingPasswordId: string | null;
  suspendingId: string | null;
  onAssign: (op: Operator) => void;
  onRenew: (opId: string) => void;
  onCancel: (opId: string) => void;
  onResetPassword: (op: Operator) => void;
  onSuspend: (op: Operator) => void;
  onUnsuspend: (op: Operator) => void;
}

export function OperatorsTableSection({
  operators,
  tiers,
  isLoading,
  isError,
  onRetry,
  canManage,
  renewingId,
  cancellingId,
  resettingPasswordId,
  suspendingId,
  onAssign,
  onRenew,
  onCancel,
  onResetPassword,
  onSuspend,
  onUnsuspend,
}: OperatorsTableSectionProps) {
  if (isError) {
    return (
      <ErrorState
        title="Impossible de charger les opérateurs"
        message="Vérifiez votre connexion ou réessayez."
        onRetry={onRetry}
      />
    );
  }

  // ── Mobile cards ─────────────────────────────────────────────────────────────
  const mobileContent = (
    <div className="space-y-3 md:hidden">
      {isLoading
        ? Array.from({ length: 5 }).map((_, i) => <MobileCardSkeleton key={i} />)
        : operators.length === 0
        ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Aucun opérateur"
            description="Créez le premier compte opérateur via le bouton ci-dessus."
          />
        )
        : operators.map((op) => {
            const expiring = isExpiringSoon(op.subscriptionEndDate, op.subscriptionStatus);
            const tierObj = tiers.find((t) => t.slug === op.tierSlug);
            const isSuspended = op.status === 'SUSPENDED';

            return (
              <div
                key={op.id}
                className={clsx(
                  'rounded-xl border bg-card p-4 space-y-3 transition-[border-color,box-shadow] duration-200',
                  isSuspended
                    ? 'border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.03)]'
                    : expiring
                    ? 'border-[hsl(var(--warning)/0.5)] bg-[hsl(var(--warning)/0.04)] hover:border-[hsl(var(--warning)/0.7)]'
                    : 'hover:border-primary/30 hover:[box-shadow:var(--shadow-sm)]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <OperatorAvatar firstName={op.firstName} lastName={op.lastName} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="truncate text-sm font-medium">
                          {op.firstName} {op.lastName}
                        </p>
                        <RoleBadge role="ADMIN" />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{op.email}</p>
                      {isSuspended && (
                        <p className="text-xs font-medium text-[hsl(var(--destructive))]">
                          Compte suspendu
                        </p>
                      )}
                    </div>
                  </div>
                  <OperatorActionsMenu
                    operator={op}
                    canManage={canManage}
                    isRenewing={renewingId === op.id}
                    isCancelling={cancellingId === op.id}
                    isResettingPassword={resettingPasswordId === op.id}
                    isSuspending={suspendingId === op.id}
                    onAssign={() => onAssign(op)}
                    onRenew={() => onRenew(op.id)}
                    onCancel={() => onCancel(op.id)}
                    onResetPassword={() => onResetPassword(op)}
                    onSuspend={() => onSuspend(op)}
                    onUnsuspend={() => onUnsuspend(op)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {op.tierName ? (
                    <TierBadge
                      name={op.tierName}
                      isFree={op.tierSlug === 'decouverte'}
                      slug={op.tierSlug ?? undefined}
                      size="sm"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sans tier</span>
                  )}
                  <SubscriptionStatusBadge status={op.subscriptionStatus} />
                  {expiring && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--warning))]">
                      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                      Expire bientôt
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">{op.activeRouterCount}</span>
                    /{op.routerCount}
                    {tierObj?.maxRouters != null && (
                      <span className="text-muted-foreground"> (max {tierObj.maxRouters})</span>
                    )}
                    {' '}routeurs
                  </span>
                  <span className="font-medium text-foreground">
                    {formatXof(op.revenueThisMonthXof)}
                  </span>
                </div>

                {op.subscriptionEndDate && (
                  <p className="text-xs text-muted-foreground">
                    Expire : {fmtDate(op.subscriptionEndDate)}
                  </p>
                )}
              </div>
            );
          })}
    </div>
  );

  // ── Desktop table ─────────────────────────────────────────────────────────────
  const COLS = ['Opérateur', 'Tier', 'Statut', 'Expiration', 'Routeurs', 'Revenu mois', 'Total', ''] as const;
  const RIGHT_COLS = new Set<string>(['', 'Routeurs', 'Revenu mois', 'Total']);

  const desktopContent = (
    <section
      aria-label="Liste des opérateurs"
      className="hidden overflow-hidden rounded-xl border bg-card md:block"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              {COLS.map((col) => (
                <th
                  key={col}
                  className={clsx(
                    'px-4 py-3 text-xs font-medium text-muted-foreground',
                    RIGHT_COLS.has(col) ? 'text-right' : 'text-left',
                  )}
                  scope="col"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={COLS.length} />
                ))
              : operators.length === 0
              ? (
                <tr>
                  <td colSpan={COLS.length} className="px-4 py-16 text-center">
                    <EmptyState
                      icon={<Users className="h-5 w-5" />}
                      title="Aucun opérateur"
                      description="Créez le premier compte opérateur via le bouton ci-dessus."
                    />
                  </td>
                </tr>
              )
              : operators.map((op) => {
                  const expiring = isExpiringSoon(op.subscriptionEndDate, op.subscriptionStatus);
                  const tierObj = tiers.find((t) => t.slug === op.tierSlug);
                  const isSuspended = op.status === 'SUSPENDED';

                  return (
                    <tr
                      key={op.id}
                      className={clsx(
                        'transition-colors hover:bg-muted/20',
                        isSuspended && 'border-l-2 border-l-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.03)]',
                        !isSuspended && expiring && 'border-l-2 border-l-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.04)]',
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <OperatorAvatar firstName={op.firstName} lastName={op.lastName} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="truncate font-medium">
                                {op.firstName} {op.lastName}
                              </p>
                              <RoleBadge role="ADMIN" />
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{op.email}</p>
                            {isSuspended && (
                              <p className="text-xs font-medium text-[hsl(var(--destructive))]">
                                Compte suspendu
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {op.tierName ? (
                          <TierBadge
                            name={op.tierName}
                            isFree={op.tierSlug === 'decouverte'}
                            slug={op.tierSlug ?? undefined}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <SubscriptionStatusBadge status={op.subscriptionStatus} />
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {expiring ? (
                          <span className="inline-flex items-center gap-1 font-medium text-[hsl(var(--warning))]">
                            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="sr-only">Attention : </span>
                            {fmtDate(op.subscriptionEndDate)}
                          </span>
                        ) : (
                          fmtDate(op.subscriptionEndDate)
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <RouterUsageBar
                          active={op.activeRouterCount}
                          total={op.routerCount}
                          max={tierObj?.maxRouters ?? null}
                        />
                      </td>

                      <td className="px-4 py-3 text-right text-xs font-medium tabular-nums">
                        {formatXof(op.revenueThisMonthXof)}
                      </td>

                      <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                        {formatXof(op.revenueTotalXof)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <OperatorActionsMenu
                          operator={op}
                          canManage={canManage}
                          isRenewing={renewingId === op.id}
                          isCancelling={cancellingId === op.id}
                          isResettingPassword={resettingPasswordId === op.id}
                          isSuspending={suspendingId === op.id}
                          onAssign={() => onAssign(op)}
                          onRenew={() => onRenew(op.id)}
                          onCancel={() => onCancel(op.id)}
                          onResetPassword={() => onResetPassword(op)}
                          onSuspend={() => onSuspend(op)}
                          onUnsuspend={() => onUnsuspend(op)}
                        />
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <>
      {mobileContent}
      {desktopContent}
    </>
  );
}
