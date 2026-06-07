'use client';

import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import type { TopRecurringClient, TopRecurringPlan } from './analytics.types';
import { formatCurrency } from './analytics.utils';

type Tab = 'clients' | 'plans';

interface Props {
  clients: TopRecurringClient[];
  plans: TopRecurringPlan[];
  isLoading: boolean;
}

export function AnalyticsTopRankingPanel({ clients, plans, isLoading }: Props) {
  const [tab, setTab] = useState<Tab>('clients');

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {/* Tabs — mobile: stacked, md+: side-by-side via hidden/block */}
      <div className="flex gap-1 border-b border-border/60 pb-2">
        <button
          type="button"
          onClick={() => setTab('clients')}
          aria-current={tab === 'clients' ? 'true' : undefined}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${
            tab === 'clients'
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Top clients (30j)
        </button>
        <button
          type="button"
          onClick={() => setTab('plans')}
          aria-current={tab === 'plans' ? 'true' : undefined}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${
            tab === 'plans'
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Top forfaits (30j)
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
        </div>
      ) : tab === 'clients' ? (
        <ClientsTable clients={clients} />
      ) : (
        <PlansTable plans={plans} />
      )}
    </div>
  );
}

function ClientsTable({ clients }: { clients: TopRecurringClient[] }) {
  if (clients.length === 0) {
    return <EmptyState title="Pas assez de données" description="Aucun client récurrent sur les 30 derniers jours." className="p-6" />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Top clients récurrents sur 30 jours">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Client</th>
            <th className="pb-2 pr-3 font-medium">Abonnements</th>
            <th className="pb-2 text-right font-medium">Montant</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((item) => (
            <tr key={item.userId} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
              <td className="py-2 pr-3">
                <p className="font-medium">{item.customerName}</p>
                <p className="text-xs text-muted-foreground">{item.customerEmail}</p>
              </td>
              <td className="py-2 pr-3 tabular-nums">{item.subscriptionsCount}</td>
              <td className="py-2 text-right tabular-nums">
                {formatCurrency(item.totalSpentXof)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlansTable({ plans }: { plans: TopRecurringPlan[] }) {
  if (plans.length === 0) {
    return <EmptyState title="Pas assez de données" description="Aucun forfait récurrent sur les 30 derniers jours." className="p-6" />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Top forfaits récurrents sur 30 jours">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Forfait</th>
            <th className="pb-2 pr-3 font-medium">Abonnements</th>
            <th className="pb-2 text-right font-medium">Montant</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((item) => (
            <tr key={item.planId} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
              <td className="py-2 pr-3 font-medium">{item.planName}</td>
              <td className="py-2 pr-3 tabular-nums">{item.subscriptionsCount}</td>
              <td className="py-2 text-right tabular-nums">
                {formatCurrency(item.totalRevenueXof)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
