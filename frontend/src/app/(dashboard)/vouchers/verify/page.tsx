'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiError, unwrap } from '@/lib/api';
import { hasPermission, isAdminUser } from '@/lib/permissions';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
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
import { VouchersTabs } from '../vouchers-tabs';
import { VoucherStatusBadge } from '@/components/ui/voucher-status-badge';
import { PriceLabel } from '@/components/ui/price-label';

interface TicketVerificationResult {
  source: 'SAAS' | 'LEGACY';
  voucherId: string | null;
  routerId: string | null;
  code: string;
  status: string;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();

  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canAdminDeleteTicket = isAdminUser(currentUser) && hasPermission(currentUser, 'tickets.delete');

  const verifyMutation = useMutation({
    mutationFn: () => api.vouchers.verify(ticket, advancedMode ? password : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      const result = verifyMutation.data
        ? unwrap<TicketVerificationResult>(verifyMutation.data)
        : undefined;
      return api.vouchers.deleteVerified(ticket, advancedMode ? password : undefined, result?.routerId ?? undefined);
    },
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
      setTicket('');
      setPassword('');
      toast.success(message);
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(
        err?.response?.data?.message ?? 'Suppression permanente impossible pour ce ticket.',
      );
    },
  });

  const handleSubmit = () => {
    if (!ticket.trim()) return;
    if (advancedMode && !password.trim()) return;
    verifyMutation.mutate();
  };

  const result: TicketVerificationResult | undefined = verifyMutation.data
    ? unwrap<TicketVerificationResult>(verifyMutation.data)
    : undefined;
  const errorMessage = apiError(
    verifyMutation.error,
    'Ticket introuvable, ou mot de passe invalide si la vérification avancée est activée.',
  );

  return (
    <div className="space-y-4">
      <VouchersTabs permissions={{ canView: true, canCreate: false, canVerify: true }} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Vérifier un ticket</h1>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Outil interne pour contrôler un ticket SaaS ou un ancien ticket encore sur le routeur.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Formulaire */}
        <div className="space-y-5 rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Contrôle ticket</h2>
              <p className="text-sm text-muted-foreground">
                Un seul ticket à saisir par défaut : code = mot de passe
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="ticket-input" className="text-sm font-medium">Ticket</label>
              <input
                id="ticket-input"
                value={ticket}
                onChange={(e) => setTicket(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                placeholder="MS-ABCD-EFGH-IJKL ou 7d8848227"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border bg-background px-4 py-3 font-mono text-sm tracking-[0.16em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
              <p className="text-xs text-muted-foreground">
                Sans mode avancé, le même ticket est vérifié comme code et mot de passe.
                Les anciens tickets en minuscules sont acceptés tels quels.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAdvancedMode((v) => !v)}
              className="inline-flex items-center gap-2 rounded text-sm text-muted-foreground transition-all duration-200 ease-out hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedMode ? 'rotate-180' : ''}`} />
              Ancien ticket avec mot de passe différent
            </button>

            {advancedMode && (
              <div className="space-y-1.5">
                <label htmlFor="password-input" className="text-sm font-medium">
                  Mot de passe ancien ticket
                </label>
                <input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                  placeholder="********"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={verifyMutation.isPending || !ticket.trim() || (advancedMode && !password.trim())}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-all duration-200 ease-out hover:bg-primary/90 hover:shadow-[var(--shadow-glow)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
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
            Cette vérification est interne seulement. Le ticket n&apos;est jamais vérifiable
            publiquement côté client.
          </div>
        </div>

        {/* Résultat */}
        <div className="rounded-2xl border bg-card p-6">
          {!result && !verifyMutation.isError && (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <Ticket className="h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">Résultat de la vérification</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Utilise cet écran quand un client affirme qu&apos;un ticket ne passe pas,
                ou quand tu veux contrôler un ticket papier avant utilisation.
              </p>
            </div>
          )}

          {verifyMutation.isError && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
              <div className="flex items-start gap-3 text-destructive">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold">Vérification refusée</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-5">
              <div
                className={`rounded-2xl border p-5 ${
                  result.canLogin
                    ? 'border-success/20 bg-success/5'
                    : 'border-warning/20 bg-warning/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.canLogin ? (
                    <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-success" />
                  ) : (
                    <Ban className="mt-0.5 h-6 w-6 shrink-0 text-warning" />
                  )}
                  <div>
                    <h2 className="text-lg font-semibold">{result.message}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.advice}</p>
                  </div>
                </div>

                {canAdminDeleteTicket && (
                  <div className="mt-4 border-t border-border/60 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deleteMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-all duration-200 ease-out hover:bg-destructive/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleteMutation.isPending ? 'Suppression en cours...' : 'Supprimer définitivement'}
                    </button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Réservé aux admins. La suppression retire aussi le ticket côté MikroTik/Winbox.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'Source', value: result.source === 'SAAS' ? 'Plateforme SaaS' : 'Ticket legacy routeur' },
                  { label: 'Code', value: result.code, mono: true },
                  { label: 'Forfait', value: result.planName },
                  { label: 'Durée', value: formatDuration(result.durationMinutes) },
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
                <div className="rounded-xl border bg-muted/20 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Statut</p>
                  <div className="mt-2">
                    <VoucherStatusBadge status={result.status} />
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/20 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Prix</p>
                  <p className="mt-2 text-sm font-medium">
                    <PriceLabel amount={result.priceXof} />
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-success">Lecture terrain</p>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    Si le ticket est <strong>Livré</strong> ou <strong>Actif</strong>, le client doit pouvoir l&apos;utiliser sur la page hotspot actuelle.
                  </p>
                  <p className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    Si le ticket est <strong>Généré</strong> ou <strong>Échec livraison</strong>, relance la livraison depuis l&apos;écran Tickets.
                  </p>
                  <p className="flex items-start gap-2">
                    <Ban className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    Si la vérification échoue, le ticket n&apos;est pas valide pour ton périmètre ou le mot de passe est incorrect.
                  </p>
                  <p className="flex items-start gap-2">
                    <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    Les anciens tickets en minuscules sont acceptés tels quels. Ne change pas leur casse pendant la saisie.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={result ? `Supprimer le ticket ${result.code} ?` : 'Supprimer ce ticket ?'}
        description={
          result
            ? `Cette action retire le ticket du routeur${result.source === 'SAAS' ? ' et de la plateforme si possible' : ''}. L'historique sera conservé si le ticket a déjà servi.`
            : ''
        }
        confirmLabel="Supprimer définitivement"
        isLoading={deleteMutation.isPending}
        onConfirm={() => { setShowDeleteConfirm(false); deleteMutation.mutate(); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
