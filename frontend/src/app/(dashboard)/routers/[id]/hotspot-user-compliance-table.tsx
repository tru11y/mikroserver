'use client';

'use client';

import { clsx } from 'clsx';
import { Pencil } from 'lucide-react';
import { EnforcementBadge } from '@/components/ui/enforcement-badge';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import type { HotspotUserRow } from './router-detail.types';
import { HotspotUserCardMobile } from './hotspot-user-card-mobile';

const ENFORCEMENT_PRIORITY: Record<HotspotUserRow['enforcementStatus'], number> = {
  EXPIRED_BUT_ACTIVE: 0,
  UNMANAGED: 1,
  ACTIVE_OK: 2,
  EXPIRED: 3,
  INACTIVE_OK: 4,
};

function sortByCompliance(users: HotspotUserRow[]): HotspotUserRow[] {
  return [...users].sort((a, b) => {
    const diff =
      ENFORCEMENT_PRIORITY[a.enforcementStatus] -
      ENFORCEMENT_PRIORITY[b.enforcementStatus];
    if (diff !== 0) return diff;
    if (a.remainingMinutes !== null && b.remainingMinutes !== null) {
      return a.remainingMinutes - b.remainingMinutes;
    }
    return 0;
  });
}

interface HotspotUserComplianceTableProps {
  users: HotspotUserRow[];
  isLoading: boolean;
  errorMessage: string | null;
  canManage: boolean;
  onChangeProfile: (user: HotspotUserRow) => void;
  onRetry?: () => void;
}

export function HotspotUserComplianceTable({
  users,
  isLoading,
  errorMessage,
  canManage,
  onChangeProfile,
  onRetry,
}: HotspotUserComplianceTableProps) {
  if (isLoading) {
    return (
      <>
        <div className="md:hidden space-y-3 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j}>
                    <Skeleton className="mb-1 h-3 w-12" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <tbody>
              <TableRowSkeleton cols={7} />
              <TableRowSkeleton cols={7} />
              <TableRowSkeleton cols={7} />
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (errorMessage) {
    return (
      <ErrorState
        title="Impossible de charger les utilisateurs"
        message={errorMessage}
        onRetry={onRetry}
        variant="inline"
        className="py-10"
      />
    );
  }

  if (users.length === 0) {
    return (
      <div className="py-10">
        <EmptyState
          title="Aucun utilisateur hotspot détecté"
          description="Aucun utilisateur n'est enregistré sur ce routeur, ou la lecture RouterOS n'a pas encore abouti."
        />
      </div>
    );
  }

  const sorted = sortByCompliance(users);

  return (
    <>
      <p className="px-5 pt-4 pb-2 text-xs text-muted-foreground">
        {users.length} utilisateur{users.length > 1 ? 's' : ''} — triés par priorité de conformité.
      </p>

      {/* Mobile */}
      <div className="md:hidden space-y-3 p-4">
        {sorted.map((user) => (
          <HotspotUserCardMobile
            key={user.id}
            user={user}
            canManageHotspot={canManage}
            onChangeProfile={onChangeProfile}
          />
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              {[
                'Utilisateur',
                'Profil',
                'Conformité',
                'Expiration',
                'État',
                'Adresse active',
                ...(canManage ? [''] : []),
              ].map((label) => (
                <th
                  key={label || 'actions'}
                  className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((user) => (
              <tr
                key={user.id}
                className={clsx(
                  'transition-colors',
                  user.enforcementStatus === 'EXPIRED_BUT_ACTIVE'
                    ? 'bg-destructive/5 hover:bg-destructive/10'
                    : 'hover:bg-muted/10',
                )}
              >
                <td className="px-4 py-3">
                  <p className="font-mono text-xs">{user.username}</p>
                  {user.comment && (
                    <p className="text-xs text-muted-foreground mt-0.5">{user.comment}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">{user.profile ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <EnforcementBadge status={user.enforcementStatus} />
                    {user.planName && (
                      <span className="text-[11px] text-muted-foreground">
                        {user.planName}
                        {user.voucherStatus ? ` (${user.voucherStatus})` : ''}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {user.voucherExpiresAt
                    ? new Date(user.voucherExpiresAt).toLocaleString('fr-FR')
                    : '—'}
                  {user.remainingMinutes !== null && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {user.remainingMinutes <= 0
                        ? `${Math.abs(user.remainingMinutes)} min dépassées`
                        : `${user.remainingMinutes} min restantes`}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  <span
                    className={
                      user.active
                        ? 'text-success'
                        : 'text-muted-foreground'
                    }
                  >
                    {user.active ? `Actif (${user.activeSessionCount})` : 'Inactif'}
                  </span>
                  {user.disabled && (
                    <p className="text-[11px] text-destructive mt-0.5">Désactivé</p>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {user.activeAddress ?? '—'}
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onChangeProfile(user)}
                      aria-label={`Changer le profil de ${user.username}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      Changer profil
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
