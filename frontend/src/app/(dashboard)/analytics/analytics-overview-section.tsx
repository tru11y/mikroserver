'use client';

import type { ComponentType } from 'react';
import { BarChart3, CreditCard, Download, TrendingUp, Users, Wifi } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import type { AnalyticsKpiResponse } from './analytics.types';
import { formatCurrency } from './analytics.utils';

const SECTION_LINKS = [
  { href: '#subscriptions', label: 'Abonnements' },
  { href: '#recommendations', label: 'Recommandations' },
  { href: '#tickets', label: 'Tickets' },
  { href: '#charts', label: 'Courbes' },
];

export function AnalyticsOverviewSection({
  metrics,
  canExportReports,
  isExporting,
  onExport,
}: {
  metrics: AnalyticsKpiResponse;
  canExportReports: boolean;
  isExporting: boolean;
  onExport: () => void;
}) {
  const stats: Array<{
    label: string;
    value: string;
    icon: ComponentType<{ className?: string }>;
    variant: 'primary' | 'success' | 'warning' | 'danger';
  }> = [
    {
      label: 'Revenus ce mois',
      value: formatCurrency(metrics.revenue?.thisMonth ?? 0),
      icon: CreditCard,
      variant: 'primary',
    },
    {
      label: 'Transactions ce mois',
      value: String(metrics.transactions?.thisMonth ?? 0),
      icon: TrendingUp,
      variant: 'success',
    },
    {
      label: 'Clients uniques',
      value: String(metrics.customers?.uniqueThisMonth ?? 0),
      icon: Users,
      variant: 'warning',
    },
    {
      label: 'Routeurs en ligne',
      value: `${metrics.routers?.online ?? 0} / ${metrics.routers?.total ?? 0}`,
      icon: Wifi,
      variant: 'primary',
    },
  ];

  return (
    <section id="overview" className="space-y-5">
      <div className="rounded-2xl border bg-[linear-gradient(135deg,rgba(59,130,246,0.10),rgba(16,185,129,0.06),rgba(0,0,0,0))] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <BarChart3 className="h-3.5 w-3.5" />
              Cockpit operations
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Rapports</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pilotage tickets, activations, incidents de delivery et exploitation terrain,
              avec une lecture plus claire par section.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
            {canExportReports && (
              <button
                type="button"
                onClick={onExport}
                disabled={isExporting}
                className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {isExporting ? 'Export en cours...' : 'Exporter CSV'}
              </button>
            )}

            <div className="flex flex-wrap gap-2">
              {SECTION_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, variant }) => (
          <KpiCard
            key={label}
            title={label}
            value={value}
            variant={variant}
            icon={<Icon className="h-4 w-4" />}
          />
        ))}
      </div>
    </section>
  );
}
