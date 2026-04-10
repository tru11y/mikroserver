'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestResetMutation = useMutation({
    mutationFn: () => api.auth.requestPasswordReset(email.trim()),
    onSuccess: () => {
      setSubmitted(true);
      setError(null);
    },
    onError: (err: any) => {
      setError(
        err?.response?.data?.message ??
          'Impossible de lancer la reinitialisation pour le moment.',
      );
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm space-y-5">
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Mot de passe oublie</h1>
          <p className="text-sm text-muted-foreground">
            Saisis ton email admin. Tu recevras un lien et un code OTP pour confirmer la reinitialisation.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-300" />
              <p>
                Si ce compte existe, un email a ete envoye. Verifie ta boite de reception.
              </p>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              requestResetMutation.mutate();
            }}
          >
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <label className="space-y-1.5 block">
              <span className="text-sm font-medium">Email administrateur</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="admin@mikroserver.com"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={requestResetMutation.isPending || !email.trim()}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {requestResetMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Envoyer le lien de reset
            </button>
          </form>
        )}

        <div className="text-xs text-muted-foreground">
          <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
            Retour a la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
