'use client';

import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart3 as BarChart3Icon } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { PeriodShortcut, DEFAULT_PERIOD_OPTIONS } from '@/components/ui/period-shortcut';
import type { PeriodOption } from '@/components/ui/period-shortcut';
import type { FormattedRevenuePoint } from './analytics.types';
import { formatCurrency } from './analytics.utils';

const CHART_HEIGHT = 220;

const SECTION_ID = 'analytics-charts-heading';

const chartConfig = {
  revenus:      { label: 'Revenus',      color: 'hsl(var(--primary))'    },
  transactions: { label: 'Transactions', color: 'hsl(var(--brand-pink))' },
};

function formatAxisDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMM', { locale: fr });
  } catch {
    return dateStr;
  }
}

function formatTooltipDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy', { locale: fr });
  } catch {
    return dateStr;
  }
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `${Math.round(value / 1_000)}k`;
  return String(value);
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};

interface Props {
  points: FormattedRevenuePoint[];
  rawPoints: Array<{ date: string; revenus: number; transactions: number }>;
  isLoading: boolean;
  periodKey: string;
  periodDays: number;
  onPeriodChange: (opt: PeriodOption) => void;
}

export function AnalyticsRevenueChartsSection({
  points,
  rawPoints,
  isLoading,
  periodKey,
  periodDays,
  onPeriodChange,
}: Props) {
  const data = rawPoints.length > 0 ? rawPoints : points;

  return (
    <section aria-labelledby={SECTION_ID} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id={SECTION_ID}
            className="text-sm font-semibold"
          >
            Revenus &amp; transactions
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Historique journalier en FCFA
          </p>
        </div>
        <PeriodShortcut
          options={DEFAULT_PERIOD_OPTIONS}
          activeKey={periodKey}
          onChange={onPeriodChange}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Revenus */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-1 text-sm font-semibold">
            {chartConfig.revenus.label}
            <span className="ml-1 text-xs font-normal text-muted-foreground">FCFA</span>
          </h3>

          {isLoading ? (
            <ChartSkeleton rows={12} />
          ) : data.length === 0 ? (
            <EmptyState
              icon={<BarChart3Icon className="h-5 w-5" />}
              title="Aucune donnée"
              description={`Aucun revenu enregistré sur les ${periodDays} derniers jours.`}
              className="h-[220px]"
            />
          ) : (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={chartConfig.revenus.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartConfig.revenus.color} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatAxisDate}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(label: string) => formatTooltipDate(label)}
                  formatter={(value: number) => [formatCurrency(value), chartConfig.revenus.label]}
                />
                <Area
                  type="monotone"
                  dataKey="revenus"
                  stroke={chartConfig.revenus.color}
                  fill="url(#gradRevenue)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Transactions */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-1 text-sm font-semibold">
            {chartConfig.transactions.label}
            <span className="ml-1 text-xs font-normal text-muted-foreground">paiements Wave</span>
          </h3>

          {isLoading ? (
            <ChartSkeleton rows={12} />
          ) : data.length === 0 ? (
            <EmptyState
              title="Aucune donnée"
              description={`Aucune transaction enregistrée sur les ${periodDays} derniers jours.`}
              className="h-[220px]"
            />
          ) : (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatAxisDate}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(label: string) => formatTooltipDate(label)}
                  formatter={(value: number) => [value, chartConfig.transactions.label]}
                />
                <Bar
                  dataKey="transactions"
                  fill={chartConfig.transactions.color}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}
