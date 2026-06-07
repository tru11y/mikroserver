'use client';

import { clsx } from 'clsx';
import { Pencil } from 'lucide-react';
import { EnforcementBadge } from '@/components/ui/enforcement-badge';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import type { HotspotUserRow } from './router-detail.types';
import type { HotspotComplianceSummary } from './router-detail.selectors';
import { formatElapsedFromMinutes } from './router-detail.utils';
import { HotspotComplianceBanner } from './hotspot-compliance-banner';
import { HotspotUserCardMobile } from './hotspot-user-card-mobile';

interface HotspotUsersSectionProps {
  canManageHotspot: boolean;
  errorMessage: string | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
  users: HotspotUserRow[];
  complianceSummary: HotspotComplianceSummary;
  onRetry?: () => void;
  onChangeProfile: (user: HotspotUserRow) => void;
}

export function HotspotUsersSection({
  canManageHotspot,
  errorMessage,
  searchValue,
  onSearchChange,
  isLoading,
  users,
  complianceSummary,
  onRetry,
  onChangeProfile,
}: HotspotUsersSectionProps) {
  const hasSearchQuery = searchValue.trim().length > 0;

  return (
    <section
      id="section-panel-users"
      aria-labelledby="hotspot-users-heading"
      className="rounded-xl border bg-card overflow-hidden"
    >
      <div className="px-5 py-4 border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 id="hotspot-users-heading" className="font-semibold">
              Recherche utilisateur hotspot
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recherche précise d'un utilisateur actif ou inactif pour changer son profil.
            </p>
            {!canManageHotspot && (
              <p className="mt-2 text-xs text-warning">
                Mode lecture seule : permission <code>routers.hotspot_manage</code> requise.
              </p>
            )}
          </div>
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher un utilisateur ou un profil"
            aria-label="Rechercher un utilisateur hotspot"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-64 sm:flex-shrink-0"
          />
        </div>
      </div>

      {hasSearchQuery && !errorMessage && (
        <HotspotComplianceBanner isLoading={isLoading} summary={complianceSummary} />
      )}

      {!hasSearchQuery ? (
        <div className="p-6 space-y-2 text-sm text-muted-foreground">
          <p>Saisis un identifiant précis pour lancer la lecture RouterOS des utilisateurs hotspot.</p>
          <p className="text-xs">
            La lecture est différée jusqu'à la recherche pour éviter les timeouts sur les hotspots chargés.
          </p>
        </div>
      ) : isLoading ? (
        <>
          {/* Mobile skeleton */}
          <div className="md:hidden space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-16 rounded-full" />
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
          {/* Desktop skeleton */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <tbody>
                <TableRowSkeleton cols={9} />
                <TableRowSkeleton cols={9} />
                <TableRowSkeleton cols={9} />
              </tbody>
            </table>
          </div>
        </>
      ) : errorMessage ? (
        <ErrorState
          title="Impossible de charger les utilisateurs"
          message={errorMessage}
          onRetry={onRetry}
          variant="inline"
          className="py-10"
        />
      ) : users.length === 0 ? (
        <div className="py-10">
          <EmptyState
            title="Aucun résultat"
            description="Aucun utilisateur hotspot ne correspond à la recherche."
          />
        </div>
      ) : (
        <>
          <p className="px-5 pt-4 text-xs text-muted-foreground">
            {users.length} résultat(s) pour cette recherche.
          </p>

          {/* Mobile — card list */}
          <div className="md:hidden space-y-3 p-4">
            {users.map((user) => (
              <HotspotUserCardMobile
                key={user.id}
                user={user}
                canManageHotspot={canManageHotspot}
                onChangeProfile={onChangeProfile}
              />
            ))}
          </div>

          {/* Desktop — table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {[
                    'Utilisateur',
                    'Profil',
                    'État',
                    'Adresse active',
                    '1ère connexion',
                    'Écoulé',
                    'Expiration',
                    'Conformité',
                    'Uptime',
                    ...(canManageHotspot ? [''] : []),
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
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs">{user.username}</p>
                      {user.comment && (
                        <p className="text-xs text-muted-foreground mt-1">{user.comment}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{user.profile ?? '-'}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={clsx(
                            'rounded-full border px-2 py-0.5',
                            user.active
                              ? 'border-success/30 text-success'
                              : 'border-border text-muted-foreground',
                          )}
                        >
                          {user.active ? `Actif (${user.activeSessionCount})` : 'Inactif'}
                        </span>
                        {user.disabled && (
                          <span className="rounded-full border border-destructive/30 px-2 py-0.5 text-destructive">
                            Désactivé
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs">{user.activeAddress ?? '-'}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {user.activeMacAddress ?? '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {user.firstConnectionAt
                        ? new Date(user.firstConnectionAt).toLocaleString('fr-FR')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {formatElapsedFromMinutes(user.elapsedSinceFirstConnectionMinutes)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {user.voucherExpiresAt
                        ? new Date(user.voucherExpiresAt).toLocaleString('fr-FR')
                        : '-'}
                      {user.remainingMinutes !== null && (
                        <p className="text-[11px] text-muted-foreground">
                          {user.remainingMinutes <= 0
                            ? `${Math.abs(user.remainingMinutes)} min dépassées`
                            : `${user.remainingMinutes} min restantes`}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-col gap-1">
                        <EnforcementBadge status={user.enforcementStatus} />
                        <span className="text-[11px] text-muted-foreground">
                          {user.planName ?? '-'}{' '}
                          {user.voucherStatus ? `(${user.voucherStatus})` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {user.uptime ?? user.limitUptime ?? '-'}
                    </td>
                    {canManageHotspot && (
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
      )}
    </section>
  );
}
