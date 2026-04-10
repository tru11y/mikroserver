import { clsx } from 'clsx';
import { Pencil } from 'lucide-react';
import type { HotspotUserRow } from './router-detail.types';
import type { HotspotComplianceSummary } from './router-detail.selectors';
import { formatElapsedFromMinutes } from './router-detail.utils';
import { HotspotComplianceBanner } from './hotspot-compliance-banner';

interface HotspotUsersSectionProps {
  canManageHotspot: boolean;
  errorMessage: string | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
  users: HotspotUserRow[];
  complianceSummary: HotspotComplianceSummary;
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
  onChangeProfile,
}: HotspotUsersSectionProps) {
  const hasSearchQuery = searchValue.trim().length > 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Recherche utilisateur hotspot</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recherche precise d un utilisateur actif ou inactif pour changer son profil. Les clients actuellement connectes se gerent dans la section "Clients connectes".
          </p>
          {!canManageHotspot && (
            <p className="mt-2 text-xs text-amber-300">
              Mode lecture seule: permission `routers.hotspot_manage` requise pour changer le profil.
            </p>
          )}
          {errorMessage && (
            <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Impossible de charger les utilisateurs hotspot: {errorMessage}
            </p>
          )}
        </div>
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Rechercher un utilisateur precis ou un profil"
          className="w-full max-w-sm rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {hasSearchQuery && !errorMessage && (
        <HotspotComplianceBanner isLoading={isLoading} summary={complianceSummary} />
      )}

      {isLoading ? (
        <div className="p-6 text-sm text-muted-foreground">
          Chargement des utilisateurs hotspot...
        </div>
      ) : !hasSearchQuery ? (
        <div className="p-6 space-y-2 text-sm text-muted-foreground">
          <p>
            Saisis un identifiant precis pour lancer la lecture RouterOS des
            utilisateurs hotspot.
          </p>
          <p className="text-xs">
            Cette zone ne charge plus toute la table par defaut. On evite ainsi
            les timeouts et on reserve la lecture lourde au moment ou tu cibles
            vraiment un utilisateur.
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          Aucun utilisateur hotspot ne correspond a la recherche.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="px-4 pt-4 text-xs text-muted-foreground">
            {users.length} resultat(s) pour cette recherche.
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Utilisateur
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Profil
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Etat
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Adresse active
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                  1ere connexion
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Ecoule
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Expiration
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Conformite
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Uptime
                </th>
                {canManageHotspot && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id}>
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
                            ? 'border-emerald-400/30 text-emerald-300'
                            : 'border-border text-muted-foreground',
                        )}
                      >
                        {user.active ? `Actif (${user.activeSessionCount})` : 'Inactif'}
                      </span>
                      {user.disabled && (
                        <span className="rounded-full border border-red-400/30 px-2 py-0.5 text-red-300">
                          Desactive
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
                          ? `${Math.abs(user.remainingMinutes)} min depassees`
                          : `${user.remainingMinutes} min restantes`}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex flex-col gap-1">
                      <span
                        className={clsx(
                          'inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px]',
                          user.enforcementStatus === 'EXPIRED_BUT_ACTIVE'
                            ? 'border-red-400/30 text-red-300'
                            : user.enforcementStatus === 'EXPIRED'
                              ? 'border-amber-400/30 text-amber-300'
                              : user.enforcementStatus === 'UNMANAGED'
                                ? 'border-border text-muted-foreground'
                                : 'border-emerald-400/30 text-emerald-300',
                        )}
                      >
                        {user.enforcementStatus === 'EXPIRED_BUT_ACTIVE'
                          ? 'Expire mais actif'
                          : user.enforcementStatus === 'EXPIRED'
                            ? 'Expire'
                            : user.enforcementStatus === 'UNMANAGED'
                              ? 'Non gere'
                              : 'Conforme'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {user.planName ?? '-'} {user.voucherStatus ? `(${user.voucherStatus})` : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {user.uptime ?? user.limitUptime ?? '-'}
                  </td>
                  {canManageHotspot && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onChangeProfile(user)}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        Changer profil
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
