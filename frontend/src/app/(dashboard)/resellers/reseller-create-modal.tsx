'use client';

import type { Dispatch, SetStateAction } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Shield, UserPlus } from 'lucide-react';
import { DashboardModalShell } from '@/components/dashboard/dashboard-modal-shell';
import type { FormData, PermissionOptions } from './resellers.types';
import { useResellerSearch } from './use-reseller-search';

function UserSearchField({
  selectedUserId,
  onSelect,
}: {
  selectedUserId: string;
  onSelect: (id: string) => void;
}) {
  const { inputValue, setInputValue, results, isFetching, debouncedQuery } = useResellerSearch();
  const showResults = results.length > 0 && !selectedUserId && debouncedQuery.length >= 2;

  return (
    <div className="col-span-2 relative space-y-1.5">
      <span className="text-sm font-medium">
        Rechercher un utilisateur existant (rôle REVENDEUR)
      </span>
      <div className="relative">
        <input
          value={selectedUserId ? (results.find((u) => u.id === selectedUserId)?.email ?? selectedUserId) : inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onSelect('');
          }}
          placeholder="Rechercher par nom ou email..."
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {isFetching && (
          <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
            Recherche...
          </span>
        )}
        {showResults && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto divide-y rounded-xl border bg-card shadow-lg">
            {results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onSelect(u.id);
                  setInputValue('');
                }}
                className="w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
              >
                <p className="font-medium">
                  {u.firstName} {u.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedUserId ? (
        <p className="flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Utilisateur sélectionné
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Optionnel — laissez vide pour créer un nouveau compte ci-dessous.
      </p>
    </div>
  );
}

interface ResellerCreateModalProps {
  open: boolean;
  form: FormData;
  setForm: Dispatch<SetStateAction<FormData>>;
  formError: string | null;
  permissionOptions: PermissionOptions;
  currentUserRole?: string | null;
  defaultPermissionProfileByRole: Record<FormData['role'], string>;
  isPending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function ResellerCreateModal({
  open,
  form,
  setForm,
  formError,
  permissionOptions,
  currentUserRole,
  defaultPermissionProfileByRole,
  isPending,
  onClose,
  onSubmit,
}: ResellerCreateModalProps) {
  if (!open) {
    return null;
  }

  const selectedProfile = permissionOptions.profiles.find(
    (profile) => profile.key === form.permissionProfile,
  );

  return (
    <DashboardModalShell
      title="Creer un nouveau compte"
      description="Un parcours plus clair pour preparer un compte commercialisable, avec role, acces initial et controles de qualite visibles."
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
    >
      <div className="space-y-6">
        {formError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Création interrompue</p>
              <p className="mt-1 text-destructive/80">{formError}</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.85fr]">
          <section className="space-y-4 rounded-[24px] border border-white/10 bg-background/40 p-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Identite du compte
              </p>
              <h3 className="mt-2 text-lg font-semibold">Base operateur</h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <UserSearchField
                selectedUserId={form.userId ?? ''}
                onSelect={(id) => setForm((current) => ({ ...current, userId: id }))}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {(['firstName', 'lastName'] as const).map((field) => (
                <label key={field} className="space-y-1.5">
                  <span className="text-sm font-medium">
                    {field === 'firstName' ? 'Prenom' : 'Nom'}
                  </span>
                  <input
                    value={form[field]}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field]: event.target.value }))
                    }
                    placeholder={field === 'firstName' ? 'Mariam' : 'Kouadio'}
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
              ))}
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Email professionnel</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="commercial@mikroserver.com"
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Telephone</span>
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="+225 01 02 03 04 05"
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Mot de passe initial</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="12 caracteres minimum"
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </section>

          <section className="space-y-4 rounded-[24px] border border-white/10 bg-info/5 p-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-info/70">
                Gouvernance
              </p>
              <h3 className="mt-2 text-lg font-semibold">Role & acces initial</h3>
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Role</span>
              <select
                value={form.role}
                onChange={(event) =>
                  setForm((current) => {
                    const role = event.target.value as FormData['role'];
                    return {
                      ...current,
                      role,
                      permissionProfile: defaultPermissionProfileByRole[role],
                    };
                  })
                }
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {currentUserRole === 'SUPER_ADMIN' ? (
                  <option value="ADMIN">Administrateur</option>
                ) : null}
                <option value="RESELLER">Revendeur</option>
                <option value="VIEWER">Lecture seule</option>
              </select>
            </label>

            <div className="space-y-2">
              <span className="text-sm font-medium">Profil d&apos;acces</span>
              <div className="grid gap-2">
                {permissionOptions.profiles.map((profile) => {
                  const selected = profile.key === form.permissionProfile;

                  return (
                    <button
                      key={profile.key}
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          permissionProfile: profile.key,
                        }))
                      }
                      className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                        selected
                          ? 'border-primary/40 bg-primary/10 shadow-glow'
                          : 'border-white/10 bg-background/40 hover:bg-background/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{profile.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {profile.description}
                          </p>
                        </div>
                        {selected ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                      </div>
                    </button>
                  );
                })}
                {permissionOptions.profiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-background/30 px-4 py-4 text-sm text-muted-foreground">
                    Aucun profil d&apos;acces charge. Verifie la permission `users.manage`.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-4 w-4 text-info" />
                <div>
                  <p className="text-sm font-medium">Lecture commerciale</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedProfile?.description ??
                      'Selectionne un profil pour cadrer les droits avant la premiere connexion.'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <UserPlus className="h-4 w-4 text-primary" />
            Le compte sera cree avec son profil de depart et pourra ensuite etre ajuste.
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border px-4 py-2 text-sm transition-all duration-200 ease-out hover:bg-muted/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all duration-200 ease-out hover:bg-primary/90 hover:shadow-glow active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {isPending ? 'Création...' : 'Créer le compte'}
            </button>
          </div>
        </div>
      </div>
    </DashboardModalShell>
  );
}
