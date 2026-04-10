'use client';

import type { Dispatch, SetStateAction } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react';
import { DashboardModalShell } from '@/components/dashboard/dashboard-modal-shell';
import type { ProfileFormData, Reseller } from './resellers.types';

interface ResellerProfileModalProps {
  reseller: Reseller | null;
  form: ProfileFormData;
  setForm: Dispatch<SetStateAction<ProfileFormData>>;
  profileError: string | null;
  passwordError: string | null;
  passwordSuccess: string | null;
  isUpdatingProfile: boolean;
  isResettingPassword: boolean;
  onClose: () => void;
  onSaveProfile: () => void;
  onResetPassword: () => void;
}

export function ResellerProfileModal({
  reseller,
  form,
  setForm,
  profileError,
  passwordError,
  passwordSuccess,
  isUpdatingProfile,
  isResettingPassword,
  onClose,
  onSaveProfile,
  onResetPassword,
}: ResellerProfileModalProps) {
  if (!reseller) {
    return null;
  }

  return (
    <DashboardModalShell
      title={`Profil de ${reseller.firstName} ${reseller.lastName}`}
      description="Separe clairement les informations d'identite et les operations de securite pour limiter les erreurs."
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-5 rounded-[24px] border border-white/10 bg-background/40 p-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Identite du compte
            </p>
            <h3 className="mt-2 text-lg font-semibold">Coordonnees visibles</h3>
          </div>

          {profileError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Modification refusee</p>
                <p className="mt-1 text-red-100/80">{profileError}</p>
              </div>
            </div>
          ) : null}

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
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            ))}
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
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
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSaveProfile}
              disabled={isUpdatingProfile}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {isUpdatingProfile ? 'Enregistrement...' : 'Enregistrer le profil'}
            </button>
          </div>
        </section>

        <section className="space-y-5 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.03))] p-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/70">
              Securite
            </p>
            <h3 className="mt-2 text-lg font-semibold">Mot de passe & sessions</h3>
          </div>

          <div className="rounded-2xl border border-white/10 bg-background/35 p-4 text-sm text-muted-foreground">
            Comme dans les outils pros, la reinitialisation coupe les sessions actives pour
            eviter les acces residuels.
          </div>

          {passwordError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Reset refuse</p>
                <p className="mt-1 text-red-100/80">{passwordError}</p>
              </div>
            </div>
          ) : null}

          {passwordSuccess ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Reset applique</p>
                <p className="mt-1 text-emerald-100/80">{passwordSuccess}</p>
              </div>
            </div>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Nouveau mot de passe</span>
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

          <div className="rounded-2xl border border-white/10 bg-background/35 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
              <div>
                <p className="text-sm font-medium">Bon usage</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Utilise ce bouton seulement en cas de perte de mot de passe, turnover ou
                  suspicion de compromission.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onResetPassword}
              disabled={isResettingPassword || form.password.length < 12}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm transition-all hover:bg-white/10 disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" />
              {isResettingPassword ? 'Reinitialisation...' : 'Reinitialiser le mot de passe'}
            </button>
          </div>
        </section>
      </div>
    </DashboardModalShell>
  );
}
