'use client';

import { BarChart3, Users, Wifi } from 'lucide-react';
import { UsageMeter, pctToUrgency } from '@/components/ui/usage-meter';
import { SubscriptionUsageSkeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import type { SaasUsage } from './use-subscription-data';

const SECTION_ID = 'usage-section-heading';

const METERS: {
  label: string;
  key: keyof SaasUsage;
  icon: React.ReactNode;
}[] = [
  { label: 'Routeurs',            key: 'routers',    icon: <Wifi className="h-3.5 w-3.5"     aria-hidden="true" /> },
  { label: 'Revendeurs',          key: 'resellers',  icon: <Users className="h-3.5 w-3.5"    aria-hidden="true" /> },
  { label: 'Transactions ce mois',key: 'monthlyTx',  icon: <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> },
];

interface SubscriptionUsageSectionProps {
  usage: SaasUsage | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function SubscriptionUsageSection({
  usage,
  isLoading,
  isError,
  onRetry,
}: SubscriptionUsageSectionProps) {
  if (isLoading) return <SubscriptionUsageSkeleton />;

  if (isError) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <ErrorState
          title="Impossible de charger l'utilisation"
          message="Une erreur est survenue lors de la récupération des données."
          onRetry={onRetry}
          variant="inline"
        />
      </div>
    );
  }

  if (!usage) return null;

  return (
    <section aria-labelledby={SECTION_ID} className="rounded-xl border bg-card p-5 space-y-4">
      <h2
        id={SECTION_ID}
        className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Utilisation
      </h2>

      {METERS.map(({ label, key, icon }) => {
        const meter = usage[key];
        const pct = meter.limit ? Math.min(100, (meter.current / meter.limit) * 100) : 0;
        return (
          <UsageMeter
            key={key}
            label={label}
            icon={icon}
            current={meter.current}
            limit={meter.limit}
            urgencyLevel={meter.limit ? pctToUrgency(pct) : 'ok'}
          />
        );
      })}
    </section>
  );
}
