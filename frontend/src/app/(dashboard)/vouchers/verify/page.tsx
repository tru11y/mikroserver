'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiError, unwrap } from '@/lib/api';
import { hasPermission, isAdminUser } from '@/lib/permissions';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Ticket,
  Loader2,
  BadgeCheck,
  Ban,
  AlertTriangle,
  Clock3,
  Wifi,
  ChevronDown,
  Trash2,
} from 'lucide-react';

interface TicketVerificationResult {
  source: 'SAAS' | 'LEGACY';
  voucherId: string | null;
  routerId: string | null;
  code: string;
  status: 'GENERATED' | 'DELIVERED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DELIVERY_FAILED';
  canLogin: boolean;
  planName: string;
  durationMinutes: number;
  priceXof: number;
  routerName?: string | null;
  deliveredAt?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  message: string;
  advice: string;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
  if (minutes < 10080) return `${Math.round(minutes / 1440)} jour(s)`;
  return `${Math.round(minutes / 10080)} semaine(s)`;
}

export default function VerifyVoucherPage() {
  const [ticket, setTicket] = useState('');
  const [password, setPassword] = useState('');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [lastVerifiedInput, setLastVerifiedInput] = useState<{
    ticket: string;
    password?: string;
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();

  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canAdminDeleteTicket =
    isAdminUser(currentUser) && hasPermission(currentUser, 'tickets.delete');

  const verifyMutation = useMutation({
    mutationFn: () => api.vouchers.verify(ticket, advancedMode ? password : undefined),
    onSuccess: () => {
      setLastVerifiedInput({
        ticket,
        password: advancedMode ? password : undefined,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (payload: { ticket: string; password?: string; routerId?: string | null }) =>
      api.vouchers.deleteVerified(payload.ticket, payload.password, payload.routerId ?? undefined),
    onSuccess: async (response) => {
      const message =
        (response ? unwrap<{ message?: string }>(response) : undefined)?.message ??
        'Ticket supprimé définitivement.';
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vouchers'] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['router-live'] }),
        queryClient.invalidateQueries({ queryKey: ['metrics'] }),
      ]);
      verifyMutation.reset();
      setLastVerifiedInput(null);
      toast.success(message);
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message ??
          'Suppression permanente impossible pour ce ticket.',
      );
    },
  });

  const result: TicketVerificationResult | undefined = verifyMutation.data
    ? unwrap<TicketVerificationResult>(verifyMutation.data)
    : undefined;
  const errorMessage =
    apiError(verifyMutation.error, 'Ticket introuvable, ou mot de passe invalide si la vérification avancée est activée.');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vérifier un ticket</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Outil interne admin/revendeur pour contrôler un ticket SaaS ou un ancien ticket encore présent sur le routeur, sans exposer cette vérification au public.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border bg-card p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Contrôle ticket</h2>
              <p className="text-sm text-muted-foreground">Un seul ticket à saisir par défaut: code = mot de passe</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ticket</label>
              <input
                value={ticket}
                onChange={(event) => setTicket(event.target.value)}
                placeholder="MS-ABCD-EFGH-IJKL ou 7d8848227"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm font-mono tracking-[0.16em] outline-none transition-colors focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                Sans mode avance, le meme ticket est verifie comme code et mot de passe. Les anciens tickets en minuscules sont acceptes tels quels. Active le mode avance pour verifier un ancien ticket avec mot de passe distinct.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAdvancedMode((value) => !value)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedMode ? 'rotate-180' : ''}`} />
              Ancien ticket avec mot de passe différent
            </button>

            {advancedMode && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Mot de passe ancien ticket</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            <button
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending || !ticket.trim() || (advancedMode && !password.trim())}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Vérification...
                </>
              ) : (
                <>
                  <Ticket className="h-4 w-4" />
                  Vérifier le ticket
                </>
              )}
            </button>
          </div>

          <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Cette vérification est interne seulement. Le ticket n’est jamais vérifiable publiquement côté client.
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          {!result && !verifyMutation.isError && (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <Ticket className="h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">Résultat de la vérification</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Utilise cet écran quand un client affirme qu’un ticket ne passe pas, ou quand tu veux contrôler un ticket papier avant utilisation.
              </p>
            </div>
          )}

          {verifyMutation.isError && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
              <div className="flex items-start gap-3 text-red-400">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold">Vérification refusée</h2>
                  <p className="mt-2 text-sm leading-6 text-red-300">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-5">
              <div
                className={`rounded-2xl border p-5 ${
                  result.canLogin
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-amber-500/20 bg-amber-500/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.canLogin ? (
                    <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
                  ) : (
                    <Ban className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />
                  )}
                  <div>
                    <h2 className="text-lg font-semibold">{result.message}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.advice}</p>
                  </div>
                </div>
                {canAdminDeleteTicket && lastVerifiedInput && (
                  <div className="mt-4 border-t border-border/60 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deleteMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleteMutation.isPending
                        ? "Suppression en cours..."
                        : "Supprimer definitvement"}
                    </button>
                    <ConfirmDialog
                      open={showDeleteConfirm}
                      title={"Supprimer le ticket " + result.code + " ?"}
                      description={
                        "Cette action retire le ticket du routeur" +
                        (result.source === "SAAS" ? " et de la plateforme si possible" : "") +
                        ". L’historique sera conserve si le ticket a deja servi."
                      }
                      confirmLabel="Supprimer definitivement"
                      isLoading={deleteMutation.isPending}
                      onConfirm={() => {
                        setShowDeleteConfirm(false);
                        deleteMutation.mutate({
                          ticket: lastVerifiedInput.ticket,
                          password: lastVerifiedInput.password,
                          routerId: result.routerId,
                        });
                      }}
                      onCancel={() => setShowDeleteConfirm(false)}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Bouton réservé aux admins. La suppression retire aussi le ticket côté MikroTik/Winbox.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'Source', value: result.source === 'SAAS' ? 'Plateforme SaaS' : 'Ticket legacy routeur' },
                  { label: 'Code', value: result.code, mono: true },
                  { label: 'Statut', value: result.status },
                  { label: 'Forfait', value: result.planName },
                  { label: 'Durée', value: formatDuration(result.durationMinutes) },
                  { label: 'Prix', value: `${result.priceXof.toLocaleString('fr-FR')} FCFA` },
                  { label: 'Routeur', value: result.routerName || 'Non affecté' },
                  { label: 'Première connexion', value: result.activatedAt ? new Date(result.activatedAt).toLocaleString('fr-FR') : 'Jamais utilisé' },
                  { label: 'Fin prévue', value: result.expiresAt ? new Date(result.expiresAt).toLocaleString('fr-FR') : 'Non démarré' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border bg-muted/20 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                    <p className={`mt-2 text-sm font-medium ${item.mono ? 'font-mono tracking-[0.15em]' : ''}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border bg-slate-950 p-5 text-slate-100">
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Lecture terrain</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <p className="flex items-start gap-2">
                    <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    Si le ticket est `DELIVERED` ou `ACTIVE`, le client doit pouvoir l’utiliser sur la page hotspot actuelle.
                  </p>
                  <p className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    Si le ticket est `GENERATED` ou `DELIVERY_FAILED`, relance la livraison depuis l’écran Tickets.
                  </p>
                  <p className="flex items-start gap-2">
                    <Ban className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    Si la vérification échoue, le ticket n’est pas valide pour ton périmètre ou le mot de passe est incorrect.
                  </p>
                  <p className="flex items-start gap-2">
                    <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    Les anciens tickets minuscules sont acceptés tels quels. Ne change pas leur casse pendant la saisie.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
