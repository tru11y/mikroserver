'use client';

import { Crown, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TierBadge } from '@/components/ui/tier-badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { OperatorSubscription, StatusConfig } from './use-subscription-data';

interface SubscriptionHeroSectionProps {
  subscription: OperatorSubscription | null;
  statusCfg: StatusConfig;
  daysUntilExpiry: number | null;
  isTrialing: boolean;
  isLoading: boolean;
}

export function SubscriptionHeroSection({
  subscription,
  statusCfg,
  daysUntilExpiry,
  isTrialing,
  isLoading,
}: SubscriptionHeroSectionProps) {
  const isExpired = subscription?.status === 'EXPIRED';

  return (
    <header>
      {isExpired && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.08)] px-4 py-3 text-sm"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-[hsl(var(--destructive))]" aria-hidden="true" />
          <p className="text-[hsl(var(--destructive))]">
            <span className="font-semibold">Abonnement expiré —</span>{' '}
            Contactez votre administrateur pour le renouveler.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary)/0.08)]"
            aria-hidden="true"
          >
            <Crown className="h-5 w-5 text-[hsl(var(--primary))]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Abonnement</h1>
            {isLoading ? (
              <Skeleton className="mt-1 h-3 w-40" />
            ) : subscription ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Statut et utilisation de votre plan
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Aucun plan actif
              </p>
            )}
          </div>
        </div>

        {!isLoading && subscription && (
          <div className="flex flex-wrap items-center gap-2">
            <TierBadge name={subscription.tier.name} isFree={subscription.tier.isFree} />
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusCfg.cls}`}
            >
              {statusCfg.label}
            </span>
            {daysUntilExpiry !== null && daysUntilExpiry >= 0 && !isExpired && (
              <span
                className={`text-xs font-semibold tabular-nums ${
                  daysUntilExpiry <= 7
                    ? 'text-[hsl(var(--warning))]'
                    : 'text-muted-foreground'
                }`}
              >
                {isTrialing ? 'Essai ' : ''}
                {daysUntilExpiry > 0
                  ? `J−${daysUntilExpiry}`
                  : format(new Date(subscription.endDate), 'dd MMM yyyy', { locale: fr })}
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
