'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { api } from '@/lib/api';
import { persistAccessToken } from '@/lib/api/client';
import { Wifi, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe requis'),
});

const totpSchema = z.object({
  code: z
    .string()
    .length(6, 'Le code doit contenir exactement 6 chiffres')
    .regex(/^\d{6}$/, 'Chiffres uniquement'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type TotpFormData = z.infer<typeof totpSchema>;

type LoginStep = 'credentials' | 'two_factor';

interface LoginResponse {
  data: {
    data: {
      requiresTwoFactor: false;
      tokens: {
        accessToken: string;
        refreshToken: string;
      };
    };
  };
}

interface TwoFactorPendingResponse {
  data: {
    data: {
      requiresTwoFactor: true;
      tempToken: string;
    };
  };
}

interface TwoFactorVerifyResponse {
  data: {
    data: {
      tokens: {
        accessToken: string;
        refreshToken: string;
      };
    };
  };
}


export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('credentials');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const credentialsForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const totpForm = useForm<TotpFormData>({
    resolver: zodResolver(totpSchema),
  });

  const onCredentialsSubmit = async (data: LoginFormData) => {
    setError(null);
    try {
      const response = await api.auth.login(data.email, data.password);
      const responseData = (response as LoginResponse | TwoFactorPendingResponse).data.data;

      if (responseData.requiresTwoFactor) {
        // 2FA required — store temp token and advance to second step
        setTempToken((responseData as { requiresTwoFactor: true; tempToken: string }).tempToken);
        setStep('two_factor');
        return;
      }

      const { accessToken } = (responseData as { requiresTwoFactor: false; tokens: { accessToken: string; refreshToken: string } }).tokens;
      persistAccessToken(accessToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message ?? 'Identifiants incorrects');
    }
  };

  const onTotpSubmit = async (data: TotpFormData) => {
    setError(null);
    if (!tempToken) {
      setError('Session expirée, veuillez vous reconnecter.');
      setStep('credentials');
      return;
    }
    try {
      const response = await api.auth.twoFaVerify(tempToken, data.code) as TwoFactorVerifyResponse;
      const { accessToken } = response.data.data.tokens;
      persistAccessToken(accessToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message ?? 'Code invalide ou expiré');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary mb-4">
            <Wifi className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold">MikroServer</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Plateforme de gestion WiFi
          </p>
        </div>

        {step === 'credentials' && (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <form onSubmit={credentialsForm.handleSubmit(onCredentialsSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  placeholder="admin@mikroserver.com"
                  {...credentialsForm.register('email')}
                />
                {credentialsForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{credentialsForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                    {...credentialsForm.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {credentialsForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{credentialsForm.formState.errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={credentialsForm.formState.isSubmitting}
                className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {credentialsForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {credentialsForm.formState.isSubmitting ? 'Connexion...' : 'Se connecter'}
              </button>

              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Mot de passe oublie ?
                </Link>
              </div>
            </form>
          </div>
        )}

        {step === 'two_factor' && (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Double authentification</p>
                <p className="text-xs text-muted-foreground">Entrez le code de votre application TOTP</p>
              </div>
            </div>

            <form onSubmit={totpForm.handleSubmit(onTotpSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="code" className="text-sm font-medium">
                  Code d&apos;authentification
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  {...totpForm.register('code')}
                />
                {totpForm.formState.errors.code && (
                  <p className="text-xs text-destructive">{totpForm.formState.errors.code.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={totpForm.formState.isSubmitting}
                className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {totpForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {totpForm.formState.isSubmitting ? 'Vérification...' : 'Vérifier'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(null); setTempToken(null); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground text-center underline underline-offset-2"
              >
                Retour à la connexion
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-4">
          Accès réservé aux administrateurs autorisés
        </p>
      </div>
    </div>
  );
}
