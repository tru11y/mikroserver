'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { ChartSkeleton } from '@/components/ui/skeleton';
import { BarChart2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { clsx } from 'clsx';

interface ChartPoint {
  date: string;
  revenueXof: number;
  transactions: number;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

const PERIODS = [
  { label: '7j',  days: 7  },
  { label: '30j', days: 30 },
  { label: '90j', days: 90 },
] as const;

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg text-sm">
      <p className="font-semibold mb-2 text-foreground">
        {format(parseISO(label), 'dd MMM yyyy', { locale: fr })}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name} :</span>
          <span className="font-medium text-foreground">
            {entry.name === 'Revenus'
              ? `${entry.value.toLocaleString('fr-CI')} FCFA`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart() {
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const { data, isLoading } = useQuery({
    queryKey: ['metrics', 'revenue-chart', days],
    queryFn: () => api.metrics.revenueChart(days),
    staleTime: 5 * 60 * 1000,
  });

  const chartData = (data?.data?.data as ChartPoint[]) ?? [];
  const isEmpty = !isLoading && chartData.length === 0;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Revenus</h3>
          <p className="text-sm text-muted-foreground">FCFA (XOF)</p>
        </div>
        <div
          className="flex rounded-md border border-border overflow-hidden"
          role="group"
          aria-label="Période du graphique"
        >
          {PERIODS.map(({ label, days: d }) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-label={`${label}${days === d ? ' (actif)' : ''}`}
              className={clsx(
                'px-2.5 py-1 text-[11px] font-medium',
                'transition-all duration-200 ease-out active:scale-[0.97]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-inset',
                days === d
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <ChartSkeleton />
      ) : isEmpty ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <BarChart2 className="h-8 w-8 opacity-30" />
          <p className="text-sm">Aucune donnée de revenus</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => format(parseISO(v), 'dd/MM', { locale: fr })}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
              }
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenueXof"
              name="Revenus"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#colorRevenue)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
