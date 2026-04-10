'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { api } from '@/lib/api';
import {
  ShieldCheck,
  ShieldOff,
  Loader2,
  QrCode,
  Copy,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

const codeSchema = z.object({
  code: z
    .string()
    .length(6, 'Le code doit contenir exactement 6 chiffres')
    .regex(/^\d{6}$/, 'Chiffres uniquement'),
});
type CodeFormData = z.infer<typeof codeSchema>;

type SetupState = 'idle' | 'scanning' | 'confirming';

interface MeResponse {
  data: {
    data: {
      twoFactorEnabled: boolean;
    };
  };
}

interface SetupResponse {
  data: {
    data: {
      secret: string;
      qrCodeUrl: string;
      manualEntryCode: string;
    };
  };
}

export default function TwoFactorPage() {
  const queryClient = useQueryClient();
  const [setupState, setSetupState] = useState<SetupState>('idle');
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: meData, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const user = (meData as MeResponse | undefined)?.data?.data;
  const twoFactorEnabled = user?.twoFactorEnabled ?? false;

  const setupForm = useForm<CodeFormData>({ resolver: zodResolver(codeSchema) });
  const disableForm = useForm<CodeFormData>({ resolver: zodResolver(codeSchema) });

  // --- Setup mutation ---
  const setupMutation = useMutation({
    mutationFn: () => api.auth.twoFaSetup(),
    onSuccess: (res) => {
      const data = (res as SetupResponse).data.data;
      setSetupData({ secret: data.secret, qrCodeUrl: data.qrCodeUrl });
      setSetupState('scanning');
    },
  });

  // --- Verify setup mutation ---
  const verifySetupMutation = useMutation({
    mutationFn: (code: string) => api.auth.twoFaVerifySetup(code),
    onSuccess: () => {
      setSuccessMsg('Double authentification activée avec succès.');
      setSetupState('idle');
      setSetupData(null);
      setupForm.reset();
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  // --- Disable mutation ---
  const disableMutation = useMutation({
    mutationFn: (code: string) => api.auth.twoFaDisable(code),
    onSuccess: () => {
      setSuccessMsg('Double authentification désactivée.');
      disableForm.reset();
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const onVerifySetupSubmit = (data: CodeFormData) => {
    setSuccessMsg(null);
    verifySetupMutation.mutate(data.code);
  };

  const onDisableSubmit = (data: CodeFormData) => {
    setSuccessMsg(null);
    disableMutation.mutate(data.code);
  };

  const copySecret = async () => {
    if (!setupData?.secret) return;
    await navigator.clipboard.writeText(setupData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Double authentification (2FA)</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Protégez votre compte avec une application TOTP (Google Authenticator, Authy, etc.)
        </p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Status badge */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border bg-card p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {twoFactorEnabled ? (
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-5 w-5 text-green-500" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <ShieldOff className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">
              {twoFactorEnabled ? 'Double authentification activée' : 'Double authentification désactivée'}
            </p>
            <p className="text-xs text-muted-foreground">
              {twoFactorEnabled
                ? 'Un code TOTP est requis à chaque connexion'
                : 'Votre compte est protégé uniquement par mot de passe'}
            </p>
          </div>
        </div>
        {twoFactorEnabled ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
            Activée
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border">
            Désactivée
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Enable flow */}
      {/* ------------------------------------------------------------------ */}
      {!twoFactorEnabled && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Activer la double authentification
          </h2>

          {setupState === 'idle' && (
            <>
              <p className="text-sm text-muted-foreground">
                Scannez le QR code avec votre application TOTP, puis confirmez avec un code.
              </p>
              {setupMutation.isError && (
                <p className="text-sm text-destructive">
                  {(setupMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur lors de la configuration'}
                </p>
              )}
              <button
                onClick={() => { setSuccessMsg(null); setupMutation.mutate(); }}
                disabled={setupMutation.isPending}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {setupMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Configurer
              </button>
            </>
          )}

          {setupState === 'scanning' && setupData && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Scannez ce QR code avec votre application TOTP, puis entrez le code généré ci-dessous.
              </p>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="rounded-xl border p-3 bg-white">
                  <Image
                    src={setupData.qrCodeUrl}
                    alt="QR Code 2FA"
                    width={180}
                    height={180}
                    unoptimized
                  />
                </div>
              </div>

              {/* Manual entry */}
              <div className="rounded-lg bg-muted/50 border px-3 py-2.5">
                <p className="text-xs text-muted-foreground mb-1">Code de saisie manuelle</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono flex-1 break-all">{setupData.secret}</code>
                  <button
                    type="button"
                    onClick={copySecret}
                    aria-label="Copier le secret"
                    className="text-muted-foreground hover:text-foreground flex-shrink-0"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSetupState('confirming')}
                className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                J&apos;ai scanné le QR code
              </button>
            </div>
          )}

          {setupState === 'confirming' && (
            <form onSubmit={setupForm.handleSubmit(onVerifySetupSubmit)} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Entrez le code à 6 chiffres affiché dans votre application TOTP.
              </p>
              {verifySetupMutation.isError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {(verifySetupMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Code invalide'}
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="setup-code" className="text-sm font-medium">
                  Code de vérification
                </label>
                <input
                  id="setup-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  {...setupForm.register('code')}
                />
                {setupForm.formState.errors.code && (
                  <p className="text-xs text-destructive">{setupForm.formState.errors.code.message}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSetupState('scanning')}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={verifySetupMutation.isPending}
                  className="flex-1 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {verifySetupMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmer
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Disable flow */}
      {/* ------------------------------------------------------------------ */}
      {twoFactorEnabled && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-destructive">
            <ShieldOff className="h-4 w-4" />
            Désactiver la double authentification
          </h2>
          <p className="text-sm text-muted-foreground">
            Entrez votre code TOTP actuel pour désactiver la 2FA. Votre compte sera moins sécurisé.
          </p>
          {disableMutation.isError && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {(disableMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Code invalide'}
            </div>
          )}
          <form onSubmit={disableForm.handleSubmit(onDisableSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="disable-code" className="text-sm font-medium">
                Code de confirmation
              </label>
              <input
                id="disable-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                {...disableForm.register('code')}
              />
              {disableForm.formState.errors.code && (
                <p className="text-xs text-destructive">{disableForm.formState.errors.code.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={disableMutation.isPending}
              className="rounded-lg bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {disableMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Désactiver la 2FA
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
