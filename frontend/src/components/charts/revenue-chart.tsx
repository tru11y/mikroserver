'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

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

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || !label) return null;

  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg text-sm">
      <p className="font-semibold mb-2 text-foreground">
        {format(parseISO(label), 'dd MMM yyyy', { locale: fr })}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
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

export function RevenueChart({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['metrics', 'revenue-chart', days],
    queryFn: () => api.metrics.revenueChart(days),
    staleTime: 5 * 60 * 1000,
  });

  const chartData = (data?.data?.data as ChartPoint[]) ?? [];

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4">
        <h3 className="font-semibold">Revenus — {days} derniers jours</h3>
        <p className="text-sm text-muted-foreground">FCFA (XOF)</p>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-muted"
              opacity={0.4}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) =>
                format(parseISO(v), 'dd/MM', { locale: fr })
              }
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
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) =>
                value === 'revenueXof' ? 'Revenus' : 'Transactions'
              }
            />
            <Area
              type="monotone"
              dataKey="revenueXof"
              name="Revenus"
              stroke="#3b82f6"
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
