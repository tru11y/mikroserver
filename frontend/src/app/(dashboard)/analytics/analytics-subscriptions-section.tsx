'use client';

import { AlertTriangle, CreditCard, TrendingUp, Users } from 'lucide-react';
import type {
  SubscriptionDailyList,
  TopRecurringClient,
  TopRecurringPlan,
} from './analytics.types';
import { formatCurrency } from './analytics.utils';

export function AnalyticsSubscriptionsSection({
  subscriptionsToday,
  subscriptionsExpiringToday,
  topRecurringClients,
  topRecurringPlans,
}: {
  subscriptionsToday: SubscriptionDailyList;
  subscriptionsExpiringToday: SubscriptionDailyList;
  topRecurringClients: TopRecurringClient[];
  topRecurringPlans: TopRecurringPlan[];
}) {
  const cards = [
    {
      label: "Abonnements pris aujourd'hui",
      value: subscriptionsToday.count,
      helper: `${subscriptionsToday.uniqueCustomers} client(s)`,
      icon: Users,
    },
    {
      label: "Forfaits qui expirent aujourd'hui",
      value: subscriptionsExpiringToday.count,
      helper: `${subscriptionsExpiringToday.uniqueCustomers} client(s)`,
      icon: AlertTriangle,
    },
    {
      label: 'Montant abonnements du jour',
      value: formatCurrency(subscriptionsToday.totalRevenueXof),
      helper: subscriptionsToday.date,
      icon: CreditCard,
    },
    {
      label: 'Montant des expirations du jour',
      value: formatCurrency(subscriptionsExpiringToday.totalRevenueXof),
      helper: subscriptionsExpiringToday.date,
      icon: TrendingUp,
    },
  ];

  return (
    <section id="subscriptions" className="rounded-xl border bg-card p-5 space-y-5">
      <div>
        <h2 className="font-semibold">Pilotage abonnements</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Vue du jour: nouveaux abonnements, expirations, clients recurrents et
          forfaits recurrents.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, helper, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h3 className="font-medium">Abonnements pris aujourd&apos;hui</h3>
          {subscriptionsToday.items.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun abonnement cree aujourd&apos;hui.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {subscriptionsToday.items.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.planName} • {formatCurrency(item.priceXof)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h3 className="font-medium">Forfaits qui expirent aujourd&apos;hui</h3>
          {subscriptionsExpiringToday.items.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucune expiration aujourd&apos;hui.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {subscriptionsExpiringToday.items.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.endDate).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.planName} • {formatCurrency(item.priceXof)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h3 className="font-medium">Top clients recurrents (30 jours)</h3>
          {topRecurringClients.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Pas assez de donnees.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Client</th>
                    <th className="pb-2 pr-2 font-medium">Abonnements</th>
                    <th className="pb-2 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {topRecurringClients.map((item) => (
                    <tr key={item.userId} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">
                        <p className="font-medium">{item.customerName}</p>
                        <p className="text-xs text-muted-foreground">{item.customerEmail}</p>
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{item.subscriptionsCount}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(item.totalSpentXof)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h3 className="font-medium">Top forfaits recurrents (30 jours)</h3>
          {topRecurringPlans.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Pas assez de donnees.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Forfait</th>
                    <th className="pb-2 pr-2 font-medium">Abonnements</th>
                    <th className="pb-2 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {topRecurringPlans.map((item) => (
                    <tr key={item.planId} className="border-b last:border-b-0">
                      <td className="py-2 pr-2 font-medium">{item.planName}</td>
                      <td className="py-2 pr-2 tabular-nums">{item.subscriptionsCount}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(item.totalRevenueXof)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
