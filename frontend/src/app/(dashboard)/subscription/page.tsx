'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Crown, Zap, X, AlertCircle, ArrowRight, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { differenceInDays } from 'date-fns';

interface SaasTier {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceXofMonthly: number;
  priceXofYearly: number | null;
  maxRouters: number | null;
  maxResellers: number | null;
  features: string[];
  isFree: boolean;
  trialDays: number;
}

interface OperatorSubscription {
  id: string;
  tierId: string;
  status: string;
  billingCycle: string;
  endDate: string;
  trialEndsAt: string | null;
  tier: SaasTier;
}

interface UsageMeter {
  current: number;
  limit: number | null;
}

interface SaasUsage {
  routers: UsageMeter;
  resellers: UsageMeter;
  monthlyTx: UsageMeter;
}

function formatXof(n: number) {
  return new Intl.NumberFormat('fr-CI', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(n);
}

const TIER_STYLES: Record<string, { border: string; badge: string; badgeLabel: string }> = {
  entrepreneur: {
    border: 'border-blue-500',
    badge: 'bg-blue-500/10 text-blue-600',
    badgeLabel: '',
  },
  pro: {
    border: 'border-primary',
    badge: 'bg-primary/10 text-primary',
    badgeLabel: 'POPULAIRE',
  },
  enterprise: {
    border: 'border-yellow-500',
    badge: 'bg-yellow-500/10 text-yellow-600',
    badgeLabel: 'PREMIUM',
  },
};

function ConfirmModal({
  tier,
  billingCycle,
  onConfirm,
  onCancel,
  loading,
}: {
  tier: SaasTier;
  billingCycle: 'MONTHLY' | 'YEARLY';
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const price =
    billingCycle === 'YEARLY' && tier.priceXofYearly
      ? tier.priceXofYearly
      : tier.priceXofMonthly;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Confirmer l&apos;abonnement</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Plan {tier.name}</p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">{tier.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Facturation</span>
            <span className="font-medium">{billingCycle === 'YEARLY' ? 'Annuelle' : 'Mensuelle'}</span>
          </div>
          {tier.trialDays > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Essai gratuit</span>
              <span className="font-medium text-green-500">{tier.trialDays} jours</span>
            </div>
          )}
          <div className="border-t pt-3 flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-lg">
              {formatXof(price)}/{billingCycle === 'YEARLY' ? 'an' : 'mois'}
            </span>
          </div>
        </div>

        {tier.trialDays > 0 && (
          <div className="flex items-start gap-2 rounded-xl bg-green-500/10 border border-green-500/20 p-3">
            <Clock className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-xs text-green-700 dark:text-green-400">
              Votre essai de <strong>{tier.trialDays} jours</strong> commence maintenant. Vous ne serez pas facturé avant la fin de la période d&apos;essai.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Le paiement sera traité via <strong>Wave Mobile Money</strong>. Vous recevrez un lien de paiement sur votre téléphone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              'Activation…'
            ) : (
              <>
                Confirmer
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelModal({
  tierName,
  endDate,
  onConfirm,
  onCancel,
  loading,
}: {
  tierName: string;
  endDate: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const daysLeft = differenceInDays(new Date(endDate), new Date());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-lg font-bold">Annuler l&apos;abonnement ?</h2>
          <p className="text-sm text-muted-foreground">
            Vous perdrez l&apos;accès au plan <strong>{tierName}</strong>{' '}
            {daysLeft > 0 ? (
              <>dans <strong>{daysLeft} jour{daysLeft > 1 ? 's' : ''}</strong></>
            ) : (
              'immédiatement'
            )}.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl bg-muted py-2.5 text-sm font-medium hover:bg-muted/70 transition-colors"
          >
            Conserver
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
          >
            {loading ? 'Annulation…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionPage() {
  const qc = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [confirmTier, setConfirmTier] = useState<SaasTier | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data: tiers } = useQuery({
    queryKey: ['saas-tiers'],
    queryFn: async () => {
      const res = await apiClient.get('/saas/tiers');
      return (res.data as unknown as { data: SaasTier[] }).data;
    },
  });

  const { data: currentSub } = useQuery({
    queryKey: ['operator-subscription'],
    queryFn: async () => {
      const res = await apiClient.get('/saas/subscription');
      return (res.data as unknown as { data: OperatorSubscription | null }).data;
    },
  });

  const { data: usage } = useQuery({
    queryKey: ['saas-usage'],
    queryFn: async () => {
      const res = await apiClient.get('/saas/usage');
      return (res.data as unknown as { data: SaasUsage }).data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const subscribeMutation = useMutation({
    mutationFn: (tierId: string) =>
      apiClient.post('/saas/subscribe', { tierId, billingCycle }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-subscription'] });
      setConfirmTier(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiClient.delete('/saas/subscription', {
        data: { reason: 'Annulé depuis le dashboard' },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-subscription'] });
      setShowCancelModal(false);
    },
  });

  const isCurrentTier = (tier: SaasTier) => currentSub?.tierId === tier.id;

  const daysUntilExpiry = currentSub?.endDate
    ? differenceInDays(new Date(currentSub.endDate), new Date())
    : null;

  const isTrialing =
    currentSub?.trialEndsAt && new Date(currentSub.trialEndsAt) > new Date();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 text-primary" />
          Abonnement
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choisissez le plan adapté à votre activité
        </p>
      </div>

      {/* Current subscription status */}
      {currentSub && (
        <div
          className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            currentSub.status === 'EXPIRED' || currentSub.status === 'CANCELLED'
              ? 'bg-destructive/5 border-destructive/20'
              : daysUntilExpiry !== null && daysUntilExpiry <= 7
              ? 'bg-orange-500/5 border-orange-500/20'
              : 'bg-primary/5 border-primary/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <Zap
              className={`h-5 w-5 shrink-0 ${
                currentSub.status === 'EXPIRED' ? 'text-destructive' : 'text-primary'
              }`}
            />
            <div>
              <p className="font-medium text-sm">
                Plan actuel :{' '}
                <strong>{currentSub.tier.name}</strong>
                {isTrialing && (
                  <span className="ml-2 text-xs text-green-500 font-normal">
                    Période d&apos;essai
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentSub.status === 'ACTIVE' && daysUntilExpiry !== null && (
                  daysUntilExpiry <= 7
                    ? `Expire dans ${daysUntilExpiry} jour${daysUntilExpiry > 1 ? 's' : ''} — pensez à renouveler`
                    : `Actif · expire le ${new Date(currentSub.endDate).toLocaleDateString('fr-FR')}`
                )}
                {(currentSub.status === 'EXPIRED' || currentSub.status === 'CANCELLED') &&
                  'Abonnement expiré — choisissez un plan pour continuer'}
              </p>
            </div>
          </div>
          {!currentSub.tier.isFree && currentSub.status === 'ACTIVE' && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="text-xs text-destructive hover:underline shrink-0"
            >
              Annuler l&apos;abonnement
            </button>
          )}
        </div>
      )}

      {/* Usage meters */}
      {usage && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold">Utilisation</h2>
          {(
            [
              { label: 'Routeurs', meter: usage.routers },
              { label: 'Revendeurs', meter: usage.resellers },
              { label: 'Transactions ce mois', meter: usage.monthlyTx },
            ] as { label: string; meter: UsageMeter }[]
          ).map(({ label, meter }) => {
            const pct = meter.limit
              ? Math.min(100, (meter.current / meter.limit) * 100)
              : 100;
            const barColor =
              meter.limit === null
                ? 'bg-emerald-500'
                : pct >= 90
                ? 'bg-red-500'
                : pct >= 70
                ? 'bg-orange-500'
                : 'bg-emerald-500';
            return (
              <div key={label} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">
                    {meter.current}/{meter.limit ?? '∞'}
                    {meter.limit === null && (
                      <span className="ml-1 text-muted-foreground">Illimité</span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-4">
        <span
          className={`text-sm ${billingCycle === 'MONTHLY' ? 'font-semibold' : 'text-muted-foreground'}`}
        >
          Mensuel
        </span>
        <button
          onClick={() =>
            setBillingCycle((c) => (c === 'MONTHLY' ? 'YEARLY' : 'MONTHLY'))
          }
          className={`relative h-6 w-12 rounded-full transition-colors ${
            billingCycle === 'YEARLY' ? 'bg-primary' : 'bg-muted'
          }`}
          aria-label="Basculer la facturation annuelle"
        >
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              billingCycle === 'YEARLY' ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
        <span
          className={`text-sm ${billingCycle === 'YEARLY' ? 'font-semibold' : 'text-muted-foreground'}`}
        >
          Annuel{' '}
          <span className="text-green-500 text-xs font-medium">2 mois offerts</span>
        </span>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiers?.map((tier) => {
          const price =
            billingCycle === 'YEARLY' && tier.priceXofYearly
              ? tier.priceXofYearly
              : tier.priceXofMonthly;
          const isCurrent = isCurrentTier(tier);
          const style = TIER_STYLES[tier.slug];
          const isDowngrade =
            currentSub && !tier.isFree && !isCurrent &&
            tier.priceXofMonthly < currentSub.tier.priceXofMonthly;

          return (
            <div
              key={tier.id}
              className={`bg-card border-2 rounded-2xl p-5 flex flex-col gap-4 transition-all ${
                style?.border ?? 'border-border'
              } ${isCurrent ? 'shadow-lg ring-2 ring-primary/20' : ''}`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-base">{tier.name}</h3>
                  {style?.badgeLabel && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${style.badge}`}
                    >
                      {style.badgeLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tier.description}</p>
              </div>

              <div>
                {tier.isFree ? (
                  <p className="text-3xl font-bold">Gratuit</p>
                ) : (
                  <>
                    <p className="text-3xl font-bold">{formatXof(price)}</p>
                    <p className="text-xs text-muted-foreground">
                      /{billingCycle === 'YEARLY' ? 'an' : 'mois'}
                    </p>
                  </>
                )}
                {tier.trialDays > 0 && !isCurrent && (
                  <p className="text-xs text-green-500 mt-1 font-medium">
                    {tier.trialDays} jours gratuits
                  </p>
                )}
              </div>

              <ul className="space-y-1.5 flex-1">
                {tier.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !isCurrent && !tier.isFree && setConfirmTier(tier)}
                disabled={isCurrent || tier.isFree}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isCurrent
                    ? 'bg-primary/10 text-primary cursor-default'
                    : tier.isFree
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : isDowngrade
                    ? 'border border-border hover:bg-muted'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {isCurrent
                  ? '✓ Plan actuel'
                  : tier.isFree
                  ? 'Plan par défaut'
                  : isDowngrade
                  ? `Passer à ${tier.name}`
                  : tier.trialDays > 0
                  ? `Essayer ${tier.name}`
                  : `Choisir ${tier.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAQ / reassurance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        {[
          { icon: '🔒', title: 'Paiement sécurisé', desc: 'Via Wave Mobile Money, leader en Afrique de l\'Ouest' },
          { icon: '🔄', title: 'Sans engagement', desc: 'Annulation à tout moment, sans frais' },
          { icon: '🎁', title: 'Essai gratuit', desc: 'Testez sans carte, pas de surprise' },
        ].map((item) => (
          <div key={item.title} className="bg-muted/20 border rounded-xl p-4">
            <p className="text-2xl mb-2">{item.icon}</p>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Modals */}
      {confirmTier && (
        <ConfirmModal
          tier={confirmTier}
          billingCycle={billingCycle}
          loading={subscribeMutation.isPending}
          onConfirm={() => subscribeMutation.mutate(confirmTier.id)}
          onCancel={() => setConfirmTier(null)}
        />
      )}

      {showCancelModal && currentSub && (
        <CancelModal
          tierName={currentSub.tier.name}
          endDate={currentSub.endDate}
          loading={cancelMutation.isPending}
          onConfirm={() => cancelMutation.mutate()}
          onCancel={() => setShowCancelModal(false)}
        />
      )}
    </div>
  );
}
