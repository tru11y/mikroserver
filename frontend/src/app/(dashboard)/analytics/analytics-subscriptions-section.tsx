'use client';

import { AlertTriangle, CreditCard, TrendingUp, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import type {
  SubscriptionDailyList,
  TopRecurringClient,
  TopRecurringPlan,
} from './analytics.types';
import { AnalyticsTopRankingPanel } from './analytics-top-ranking-panel';
import { formatCurrency } from './analytics.utils';

const SECTION_ID = 'analytics-subscriptions-heading';

function SubscriptionRow({
  name,
  time,
  planName,
  price,
}: {
  name: string;
  time: string;
  planName: string;
  price: number;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-sm">{name}</p>
        <time className="text-xs text-muted-foreground">{time}</time>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {planName} &middot; {formatCurrency(price)}
      </p>
    </div>
  );
}

interface Props {
  subscriptionsToday: SubscriptionDailyList;
  subscriptionsExpiringToday: SubscriptionDailyList;
  topRecurringClients: TopRecurringClient[];
  topRecurringPlans: TopRecurringPlan[];
  isLoading: boolean;
}

export function AnalyticsSubscriptionsSection({
  subscriptionsToday,
  subscriptionsExpiringToday,
  topRecurringClients,
  topRecurringPlans,
  isLoading,
}: Props) {
  const cards = [
    {
      label: "Abonnements du jour",
      value: subscriptionsToday.count,
      helper: `${subscriptionsToday.uniqueCustomers} client(s)`,
      icon: Users,
    },
    {
      label: "Expirations du jour",
      value: subscriptionsExpiringToday.count,
      helper: `${subscriptionsExpiringToday.uniqueCustomers} client(s)`,
      icon: AlertTriangle,
    },
    {
      label: 'Montant abonnements',
      value: formatCurrency(subscriptionsToday.totalRevenueXof),
      helper: subscriptionsToday.date,
      icon: CreditCard,
    },
    {
      label: 'Valeur expirations',
      value: formatCurrency(subscriptionsExpiringToday.totalRevenueXof),
      helper: subscriptionsExpiringToday.date,
      icon: TrendingUp,
    },
  ];

  return (
    <section aria-labelledby={SECTION_ID} className="rounded-xl border bg-card p-5 space-y-5">
      <div>
        <h2 id={SECTION_ID} className="font-semibold">
          Pilotage abonnements
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Vue du jour : nouveaux abonnements, expirations, clients récurrents et forfaits populaires.
        </p>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, helper, icon: Icon }) => (
            <div key={label} className="rounded-xl border bg-muted/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
            </div>
          ))}
        </div>
      )}

      {/* Timeline dual column */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border p-4 space-y-2">
          <h3 className="font-medium text-sm">Abonnements pris aujourd&apos;hui</h3>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : subscriptionsToday.items.length === 0 ? (
            <EmptyState title="Aucun abonnement" description="Aucun abonnement créé aujourd'hui." className="p-6" />
          ) : (
            subscriptionsToday.items.slice(0, 6).map((item) => (
              <SubscriptionRow
                key={item.id}
                name={item.customerName}
                time={new Date(item.createdAt).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                planName={item.planName}
                price={item.priceXof}
              />
            ))
          )}
        </div>

        <div className="rounded-xl border p-4 space-y-2">
          <h3 className="font-medium text-sm">Forfaits qui expirent aujourd&apos;hui</h3>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : subscriptionsExpiringToday.items.length === 0 ? (
            <EmptyState title="Aucune expiration" description="Aucun forfait n'expire aujourd'hui." className="p-6" />
          ) : (
            subscriptionsExpiringToday.items.slice(0, 6).map((item) => (
              <SubscriptionRow
                key={item.id}
                name={item.customerName}
                time={new Date(item.endDate).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                planName={item.planName}
                price={item.priceXof}
              />
            ))
          )}
        </div>
      </div>

      {/* Top ranking panel (tabs on mobile) */}
      <AnalyticsTopRankingPanel
        clients={topRecurringClients}
        plans={topRecurringPlans}
        isLoading={isLoading}
      />
    </section>
  );
}
