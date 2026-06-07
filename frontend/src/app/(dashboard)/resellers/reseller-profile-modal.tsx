'use client';

import type { Dispatch, SetStateAction } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
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

const INPUT_CLS =
  'w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

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
      description="Sépare clairement les informations d'identité et les opérations de sécurité pour limiter les erreurs."
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Identité */}
        <section
          aria-labelledby="profile-identity-heading"
          className="space-y-5 rounded-[24px] border border-white/10 bg-background/40 p-5"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Identité du compte
            </p>
            <h3 id="profile-identity-heading" className="mt-2 text-lg font-semibold">
              Coordonnées visibles
            </h3>
          </div>

          {profileError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">Modification refusée</p>
                <p className="mt-1 text-destructive/80">{profileError}</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Prénom</span>
              <input
                value={form.firstName}
                onChange={(e) => setForm((c) => ({ ...c, firstName: e.target.value }))}
                className={INPUT_CLS}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Nom</span>
              <input
                value={form.lastName}
                onChange={(e) => setForm((c) => ({ ...c, lastName: e.target.value }))}
                className={INPUT_CLS}
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              className={INPUT_CLS}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Téléphone</span>
            <input
              value={form.phone}
              onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
              placeholder="+225 01 02 03 04 05"
              className={INPUT_CLS}
            />
          </label>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSaveProfile}
              disabled={isUpdatingProfile}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all duration-200 ease-out hover:bg-primary/90 hover:shadow-glow active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isUpdatingProfile ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {isUpdatingProfile ? 'Enregistrement...' : 'Enregistrer le profil'}
            </button>
          </div>
        </section>

        {/* Sécurité */}
        <section
          aria-labelledby="profile-security-heading"
          className="space-y-5 rounded-[24px] border border-white/10 bg-success/5 p-5"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-success/70">Sécurité</p>
            <h3 id="profile-security-heading" className="mt-2 text-lg font-semibold">
              Mot de passe &amp; sessions
            </h3>
          </div>

          <p className="rounded-2xl border border-white/10 bg-background/35 p-4 text-sm text-muted-foreground">
            La réinitialisation révoque toutes les sessions actives pour éviter les accès
            résiduels.
          </p>

          {passwordError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">Réinitialisation refusée</p>
                <p className="mt-1 text-destructive/80">{passwordError}</p>
              </div>
            </div>
          ) : null}

          {passwordSuccess ? (
            <div className="flex items-start gap-3 rounded-2xl border border-success/20 bg-success/10 px-4 py-4 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">Réinitialisation appliquée</p>
                <p className="mt-1 text-success/80">{passwordSuccess}</p>
              </div>
            </div>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Nouveau mot de passe</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
              placeholder="12 caractères minimum"
              className={INPUT_CLS}
            />
          </label>

          <div className="rounded-2xl border border-white/10 bg-background/35 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-success" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Bon usage</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Utilise ce bouton uniquement en cas de perte de mot de passe, turnover ou
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
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isResettingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              )}
              {isResettingPassword ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
            </button>
          </div>
        </section>
      </div>
    </DashboardModalShell>
  );
}
