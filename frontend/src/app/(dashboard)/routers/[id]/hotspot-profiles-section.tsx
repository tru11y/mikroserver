'use client';

import { Pencil, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import type { HotspotProfile, PlanSummary } from './router-detail.types';
import { formatDurationMinutes } from './router-detail.utils';

interface PlanWithProfileInfo {
  plan: PlanSummary;
  mappedProfile?: HotspotProfile | null;
}

interface HotspotProfilesSectionProps {
  canManageHotspot: boolean;
  canViewPlans: boolean;
  errorMessage?: string | null;
  isLoading: boolean;
  profiles: HotspotProfile[];
  fallbackProfileNames: string[];
  totalTariffItems: number;
  allPlans: PlanSummary[];
  plansWithProfileInfo: PlanWithProfileInfo[];
  legacyTariffProfiles: HotspotProfile[];
  profileActionId: string | null;
  isRemovePending: boolean;
  onOpenCreate: () => void;
  onEdit: (profile: HotspotProfile) => void;
  onRemove: (profile: HotspotProfile) => void;
}

export function HotspotProfilesSection({
  canManageHotspot,
  canViewPlans,
  errorMessage,
  isLoading,
  profiles,
  fallbackProfileNames,
  totalTariffItems,
  allPlans,
  plansWithProfileInfo,
  legacyTariffProfiles,
  profileActionId,
  isRemovePending,
  onOpenCreate,
  onEdit,
  onRemove,
}: HotspotProfilesSectionProps) {
  const visibleProfilesCount =
    profiles.length > 0 ? profiles.length : fallbackProfileNames.length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Profils hotspot existants</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Profils RouterOS visibles aussi dans Winbox
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {visibleProfilesCount} profil(s)
            </span>
            {canManageHotspot && (
              <button
                onClick={onOpenCreate}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted"
              >
                <Plus className="h-3 w-3" />
                Nouveau
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Impossible de charger les profils hotspot: {errorMessage}
          </p>
        )}

        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Chargement des profils...</p>
        ) : profiles.length === 0 ? (
          fallbackProfileNames.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucun profil hotspot detecte sur ce routeur.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-200">
                Les details complets des profils Winbox ne sont pas encore remontes. Voici les noms detectes via les utilisateurs, forfaits et la configuration du routeur.
              </p>
              <div className="space-y-2">
                {fallbackProfileNames.map((profileName) => (
                  <div
                    key={profileName}
                    className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{profileName}</p>
                      <span className="rounded-full border border-amber-300/30 px-2 py-0.5 text-[11px] text-amber-200">
                        Detecte
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-amber-100/90">
                      Profil selectionnable pour les utilisateurs, mais details rx/tx encore indisponibles tant que la lecture Winbox n est pas revenue.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="mt-4 space-y-2">
            {profiles.map((profile) => (
              <div key={profile.id} className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{profile.name}</p>
                  <div className="flex items-center gap-2">
                    {profile.rateLimit && (
                      <span className="rounded-full border px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                        {profile.rateLimit}
                      </span>
                    )}
                    {canManageHotspot && (
                      <>
                        <button
                          onClick={() => onEdit(profile)}
                          className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors hover:bg-muted"
                        >
                          <Pencil className="h-3 w-3" />
                          Editer
                        </button>
                        <button
                          onClick={() => onRemove(profile)}
                          disabled={isRemovePending}
                          className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {profileActionId === profile.id ? '...' : 'Supprimer'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sessions partagees: {profile.sharedUsers ?? 'n/a'} | Session timeout:{' '}
                  {profile.sessionTimeout ?? 'n/a'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Tarifs/forfaits existants</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Forfaits SaaS + profils RouterOS legacy detectes sur le routeur
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{totalTariffItems} entree(s)</span>
        </div>

        {!canViewPlans ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Permission `plans.view` manquante. Affichage des profils RouterOS uniquement.
            </p>
            {profiles.length === 0 ? (
              fallbackProfileNames.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun profil RouterOS detecte.</p>
              ) : (
                fallbackProfileNames.map((profileName) => (
                  <div
                    key={profileName}
                    className="rounded-lg border bg-muted/20 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{profileName}</p>
                      <span className="rounded-full border px-2 py-0.5 text-[11px] text-amber-300">
                        Detecte
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Detail Winbox non charge pour ce profil.
                    </p>
                  </div>
                ))
              )
            ) : (
              profiles.map((profile) => (
                <div key={profile.id} className="rounded-lg border bg-muted/20 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{profile.name}</p>
                    <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                      RouterOS
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Debit: {profile.rateLimit ?? 'n/a'} | Timeout: {profile.sessionTimeout ?? 'n/a'}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : allPlans.length === 0 && legacyTariffProfiles.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Aucun forfait SaaS ni profil legacy detecte.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {plansWithProfileInfo.map(({ plan, mappedProfile }) => (
              <div key={plan.id} className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{plan.name}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'rounded-full border px-2 py-0.5 text-[11px]',
                        plan.status === 'ACTIVE'
                          ? 'border-emerald-400/30 text-emerald-300'
                          : 'border-amber-400/30 text-amber-300',
                      )}
                    >
                      {plan.status}
                    </span>
                    <span className="text-xs font-semibold">
                      {plan.priceXof.toLocaleString('fr-FR')} XOF
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Duree {formatDurationMinutes(plan.durationMinutes)} | Profil: {plan.userProfile ?? 'default'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Debit RouterOS: {mappedProfile?.rateLimit ?? 'n/a'} | Timeout:{' '}
                  {mappedProfile?.sessionTimeout ?? 'n/a'}
                </p>
              </div>
            ))}

            {legacyTariffProfiles.length > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
                <p className="text-xs font-medium text-amber-300">
                  Profils legacy detectes (present dans RouterOS, sans forfait SaaS associe)
                </p>
                {legacyTariffProfiles.map((profile) => (
                  <div key={profile.id} className="rounded-md border border-amber-300/30 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{profile.name}</p>
                      <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-[11px] text-amber-200">
                        Legacy
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-amber-100/90">
                      Debit: {profile.rateLimit ?? 'n/a'} | Timeout: {profile.sessionTimeout ?? 'n/a'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
