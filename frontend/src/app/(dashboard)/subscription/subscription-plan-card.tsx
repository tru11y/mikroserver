'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EmptyState } from '@/components/ui/states';
import { SubscriptionPlanCardSkeleton } from '@/components/ui/skeleton';
import type { OperatorSubscription } from './use-subscription-data';

const FEATURES_VISIBLE_MAX = 6;

interface SubscriptionPlanCardProps {
  subscription: OperatorSubscription | null;
  isLoading: boolean;
}

export function SubscriptionPlanCard({ subscription, isLoading }: SubscriptionPlanCardProps) {
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  if (isLoading) return <SubscriptionPlanCardSkeleton />;

  if (!subscription) {
    return (
      <EmptyState
        icon={<Zap className="h-5 w-5" />}
        title="Aucun abonnement actif"
        description="Contactez votre administrateur pour activer un plan."
        className="h-full"
      />
    );
  }

  const { tier, endDate, billingCycle } = subscription;
  const features = tier.features;
  const hasMoreFeatures = features.length > FEATURES_VISIBLE_MAX;
  const visibleFeatures = showAllFeatures ? features : features.slice(0, FEATURES_VISIBLE_MAX);

  const billingLabel: Record<string, string> = {
    MONTHLY: 'Mensuel',
    QUARTERLY: 'Trimestriel',
    YEARLY: 'Annuel',
    MANUAL: 'Manuel',
  };

  return (
    <article
      aria-label={`Plan ${tier.name}`}
      className="relative overflow-hidden rounded-xl border bg-card transition-all duration-200 ease-out hover:border-[hsl(var(--primary)/0.3)] hover:shadow-[var(--shadow-md)]"
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.05)] to-transparent pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-4 p-5">
        {/* Plan icon + title */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.12)]"
            aria-hidden="true"
          >
            <Zap className="h-4.5 w-4.5 text-[hsl(var(--primary))]" />
          </div>
          <div>
            <h2 className="font-semibold leading-tight">{tier.name}</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
              {billingLabel[billingCycle] ?? billingCycle}
            </p>
          </div>
        </div>

        {/* Billing info grid */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Fin d&apos;abonnement</dt>
            <dd className="font-medium mt-0.5 tabular-nums">
              {format(new Date(endDate), 'dd MMM yyyy', { locale: fr })}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Routeurs max</dt>
            <dd className="font-medium mt-0.5">{tier.maxRouters ?? '∞'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Revendeurs max</dt>
            <dd className="font-medium mt-0.5">{tier.maxResellers ?? '∞'}</dd>
          </div>
        </dl>

        {/* Features */}
        {features.length > 0 && (
          <div className="border-t pt-4">
            <p
              id="features-heading"
              className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5"
            >
              Fonctionnalités incluses
            </p>
            <ul aria-labelledby="features-heading" className="grid grid-cols-1 gap-1.5">
              {visibleFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))] mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {hasMoreFeatures && (
              <button
                type="button"
                onClick={() => setShowAllFeatures((v) => !v)}
                className="mt-2.5 flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-hover))] transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-expanded={showAllFeatures ? 'true' : 'false'}
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showAllFeatures ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
                {showAllFeatures
                  ? 'Voir moins'
                  : `Voir ${features.length - FEATURES_VISIBLE_MAX} de plus`}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
