'use client';

import { AlertCircle, CheckCircle2, KeyRound, Shield } from 'lucide-react';
import { DashboardModalShell } from '@/components/dashboard/dashboard-modal-shell';
import type { PermissionOptions, Reseller } from './resellers.types';
import { CUSTOM_PROFILE_KEY } from './resellers.utils';

interface ResellerAccessModalProps {
  reseller: Reseller | null;
  accessProfile: string;
  accessPermissions: string[];
  accessError: string | null;
  permissionOptions: PermissionOptions;
  isPending: boolean;
  onClose: () => void;
  onProfileChange: (value: string) => void;
  onTogglePermission: (permission: string) => void;
  onSubmit: () => void;
}

export function ResellerAccessModal({
  reseller,
  accessProfile,
  accessPermissions,
  accessError,
  permissionOptions,
  isPending,
  onClose,
  onProfileChange,
  onTogglePermission,
  onSubmit,
}: ResellerAccessModalProps) {
  if (!reseller) {
    return null;
  }

  const selectedProfile = permissionOptions.profiles.find(
    (profile) => profile.key === accessProfile,
  );

  return (
    <DashboardModalShell
      title={`Acces de ${reseller.firstName} ${reseller.lastName}`}
      description="Passe d'un profil standard a une gouvernance plus fine sans perdre de lisibilite."
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
    >
      <div className="space-y-6">
        {accessError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Mise a jour refusee</p>
              <p className="mt-1 text-red-100/80">{accessError}</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
          <section className="space-y-4 rounded-[24px] border border-white/10 bg-background/40 p-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Profils disponibles
              </p>
              <h3 className="mt-2 text-lg font-semibold">Selection rapide</h3>
            </div>

            <div className="grid gap-3">
              {permissionOptions.profiles.map((profile) => {
                const selected = accessProfile === profile.key;

                return (
                  <button
                    key={profile.key}
                    type="button"
                    onClick={() => onProfileChange(profile.key)}
                    className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                      selected
                        ? 'border-primary/40 bg-primary/10 shadow-[0_18px_40px_-30px_rgba(56,189,248,0.75)]'
                        : 'border-white/10 bg-background/50 hover:bg-background/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{profile.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {profile.description}
                        </p>
                        <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {profile.permissions.length} permission
                          {profile.permissions.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {selected ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => onProfileChange(CUSTOM_PROFILE_KEY)}
                className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                  accessProfile === CUSTOM_PROFILE_KEY
                    ? 'border-amber-400/30 bg-amber-400/10'
                    : 'border-white/10 bg-background/50 hover:bg-background/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Mode personnalise</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Active ou coupe des permissions au cas par cas.
                    </p>
                  </div>
                  {accessProfile === CUSTOM_PROFILE_KEY ? (
                    <CheckCircle2 className="h-4 w-4 text-amber-300" />
                  ) : null}
                </div>
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(56,189,248,0.08),rgba(255,255,255,0.03))] p-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-4 w-4 text-sky-300" />
                <div>
                  <p className="text-sm font-medium">Lecture actuelle</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedProfile?.description ??
                      'Mode personnalise actif. Toute case cochee force un acces sur mesure.'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-[24px] border border-white/10 bg-background/35 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Permissions
                </p>
                <h3 className="mt-2 text-lg font-semibold">Granularite par domaine</h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                {accessPermissions.length} permission
                {accessPermissions.length !== 1 ? 's' : ''} active
                {accessPermissions.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {permissionOptions.groups.map((group) => (
                <div
                  key={group.key}
                  className="rounded-[22px] border border-white/10 bg-background/45 p-4"
                >
                  <h4 className="text-sm font-semibold">{group.label}</h4>
                  <div className="mt-3 space-y-3">
                    {group.permissions.map((permission) => {
                      const checked = accessPermissions.includes(permission.key);

                      return (
                        <label
                          key={permission.key}
                          className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-all ${
                            checked
                              ? 'border-primary/30 bg-primary/10'
                              : 'border-white/10 bg-background/35 hover:bg-background/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onTogglePermission(permission.key)}
                            className="mt-1 h-4 w-4 rounded border-border"
                          />
                          <div>
                            <p className="text-sm font-medium">{permission.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {permission.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {permissionOptions.groups.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-white/10 bg-background/35 p-5 text-sm text-muted-foreground xl:col-span-2">
                  Aucune permission detaillee n&apos;a ete chargee. Recharge la page ou verifie
                  les droits `users.manage`.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Les changements prennent effet sur les prochains appels autorises de ce compte.
          </p>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border px-4 py-2 text-sm transition-colors hover:bg-muted/40"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isPending}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {isPending ? 'Enregistrement...' : 'Enregistrer les acces'}
            </button>
          </div>
        </div>
      </div>
    </DashboardModalShell>
  );
}
