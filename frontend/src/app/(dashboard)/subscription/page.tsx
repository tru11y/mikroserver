'use client';

import { ErrorState } from '@/components/ui/states';
import { useSubscriptionData } from './use-subscription-data';
import { SubscriptionHeroSection } from './subscription-hero-section';
import { SubscriptionPlanCard } from './subscription-plan-card';
import { SubscriptionUsageSection } from './subscription-usage-section';
import { SubscriptionCtaBlock } from './subscription-cta-block';

export default function SubscriptionPage() {
  const {
    subscription,
    usage,
    isTrialing,
    statusCfg,
    daysUntilExpiry,
    usageLevel,
    isSubLoading,
    isSubError,
    refetchSub,
    isUsageLoading,
    isUsageError,
    refetchUsage,
  } = useSubscriptionData();

  if (isSubError) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <ErrorState
          title="Impossible de charger l'abonnement"
          message="Une erreur est survenue. Vérifiez votre connexion et réessayez."
          onRetry={refetchSub}
        />
      </div>
    );
  }

  const isExpired = subscription?.status === 'EXPIRED';
  const showCta = !isSubLoading && (subscription !== null || isExpired === true);

  return (
    <main className="space-y-5 max-w-3xl">
      <SubscriptionHeroSection
        subscription={subscription}
        statusCfg={statusCfg}
        daysUntilExpiry={daysUntilExpiry}
        isTrialing={isTrialing}
        isLoading={isSubLoading}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <SubscriptionPlanCard
          subscription={subscription}
          isLoading={isSubLoading}
        />
        <SubscriptionUsageSection
          usage={usage}
          isLoading={isUsageLoading}
          isError={isUsageError}
          onRetry={refetchUsage}
        />
      </div>

      {showCta && (
        <SubscriptionCtaBlock usageLevel={usageLevel} isExpired={isExpired} />
      )}
    </main>
  );
}
