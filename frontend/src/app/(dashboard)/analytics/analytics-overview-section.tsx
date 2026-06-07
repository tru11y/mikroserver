'use client';

import {
  BarChart3,
  CreditCard,
  Download,
  Loader2,
  ShieldAlert,
  Ticket,
  TrendingUp,
  Users,
  Wifi,
} from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { KpiCardSkeleton } from '@/components/ui/skeleton';
import type { AnalyticsKpiResponse } from './analytics.types';
import { formatCurrency } from './analytics.utils';

const SECTION_ID = 'analytics-overview-heading';

function calcDelta(current: number, reference: number): { value: number; direction: 'up' | 'down' } | undefined {
  if (!reference) return undefined;
  const pct = Math.round(((current - reference) / reference) * 100);
  return { value: pct, direction: pct >= 0 ? 'up' : 'down' };
}

export function AnalyticsOverviewSection({
  metrics,
  revenueGrowth,
  isLoading,
  canExportReports,
  isExporting,
  onExport,
}: {
  metrics: AnalyticsKpiResponse;
  revenueGrowth: number | null;
  isLoading: boolean;
  canExportReports: boolean;
  isExporting: boolean;
  onExport: () => void;
}) {
  return (
    <section aria-labelledby={SECTION_ID} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            id={SECTION_ID}
            className="text-lg font-semibold tracking-tight flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
            Insights
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pilotage tickets, activations et exploitation terrain
          </p>
        </div>

        {canExportReports && (
          <button
            type="button"
            onClick={onExport}
            disabled={isExporting}
            aria-label="Exporter le rapport en CSV"
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors disabled:opacity-60 self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isExporting ? 'Export…' : 'Exporter CSV'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <KpiCard
            title="Revenus ce mois"
            value={formatCurrency(metrics.revenue?.thisMonth ?? 0)}
            icon={<CreditCard className="h-4 w-4" />}
            variant="primary"
            compact
            trend={
              revenueGrowth !== null
                ? {
                    value: Math.round(revenueGrowth * 100),
                    label: 'vs 30j',
                    direction: revenueGrowth >= 0 ? 'up' : 'down',
                  }
                : undefined
            }
          />
          <KpiCard
            title="Transactions"
            value={String(metrics.transactions?.thisMonth ?? 0)}
            icon={<TrendingUp className="h-4 w-4" />}
            variant="success"
            compact
            hint={
              metrics.transactions?.successRate != null
                ? `${Math.round(metrics.transactions.successRate * 100)}% succès`
                : undefined
            }
          />
          <KpiCard
            title="Clients uniques"
            value={String(metrics.customers?.uniqueThisMonth ?? 0)}
            icon={<Users className="h-4 w-4" />}
            variant="warning"
            compact
            hint={
              metrics.customers?.uniqueToday
                ? `+${metrics.customers.uniqueToday} aujourd'hui`
                : undefined
            }
          />
          <KpiCard
            title="Routeurs en ligne"
            value={`${metrics.routers?.online ?? 0} / ${metrics.routers?.total ?? 0}`}
            icon={<Wifi className="h-4 w-4" />}
            variant={
              (metrics.routers?.offline ?? 0) > 0 ? 'danger' : 'neutral'
            }
            compact
            hint={
              (metrics.routers?.offline ?? 0) > 0
                ? `${metrics.routers?.offline} hors ligne`
                : 'Tous opérationnels'
            }
          />
          <KpiCard
            title="Vouchers actifs"
            value={String(metrics.vouchers?.activeToday ?? 0)}
            icon={<Ticket className="h-4 w-4" />}
            variant="neutral"
            compact
          />
          <KpiCard
            title="Delivery KO"
            value={String(metrics.vouchers?.deliveryFailures ?? 0)}
            icon={<ShieldAlert className="h-4 w-4" />}
            variant={(metrics.vouchers?.deliveryFailures ?? 0) > 0 ? 'danger' : 'neutral'}
            compact
          />
        </div>
      )}
    </section>
  );
}
