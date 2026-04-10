'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const confirmResetMutation = useMutation({
    mutationFn: () =>
      api.auth.confirmPasswordReset(token.trim(), code.trim(), newPassword),
    onSuccess: () => {
      setDone(true);
      setError(null);
    },
    onError: (err: any) => {
      setError(
        err?.response?.data?.message ??
          'Impossible de reinitialiser le mot de passe.',
      );
    },
  });

  const isFormValid =
    token.trim().length >= 32 &&
    /^\d{6}$/.test(code.trim()) &&
    newPassword.length >= 12 &&
    newPassword === confirmPassword;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const tokenFromUrl =
      new URLSearchParams(window.location.search).get('token') ?? '';
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm space-y-5">
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Reinitialiser le mot de passe</h1>
          <p className="text-sm text-muted-foreground">
            Confirme avec le token du lien email et le code OTP a 6 chiffres.
          </p>
        </div>

        {done ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-300" />
                <p>Mot de passe mis a jour avec succes. Tu peux te reconnecter.</p>
              </div>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
            >
              Aller a la connexion
            </Link>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);

              if (newPassword !== confirmPassword) {
                setError('Les mots de passe ne correspondent pas.');
                return;
              }

              confirmResetMutation.mutate();
            }}
          >
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <label className="space-y-1.5 block">
              <span className="text-sm font-medium">Token reset</span>
              <input
                type="text"
                required
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Token present dans le lien email"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-sm font-medium">Code OTP (6 chiffres)</span>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm tracking-[0.25em] focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="123456"
                />
              </div>
            </label>

            <label className="space-y-1.5 block">
              <span className="text-sm font-medium">Nouveau mot de passe</span>
              <input
                type="password"
                required
                minLength={12}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-sm font-medium">Confirmer le nouveau mot de passe</span>
              <input
                type="password"
                required
                minLength={12}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>

            <button
              type="submit"
              disabled={confirmResetMutation.isPending || !isFormValid}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {confirmResetMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Confirmer la reinitialisation
            </button>
          </form>
        )}

        {!done && (
          <p className="text-xs text-muted-foreground">
            Tu n as pas recu d email ?{' '}
            <Link href="/forgot-password" className="underline underline-offset-2 hover:text-foreground">
              Relancer la demande
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
