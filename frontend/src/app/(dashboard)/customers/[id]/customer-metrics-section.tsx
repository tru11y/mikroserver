'use client';

import { Database, ShoppingBag, TrendingUp } from 'lucide-react';
import { formatBytes, formatXof } from '@/lib/format';

interface CustomerMetricsSectionProps {
  totalSessions: number;
  totalDataBytes: string;
  totalSpentXof: number;
}

export function CustomerMetricsSection({
  totalSessions,
  totalDataBytes,
  totalSpentXof,
}: CustomerMetricsSectionProps) {
  return (
    <section
      aria-labelledby="customer-metrics-heading"
      className="bg-card border rounded-xl p-5"
    >
      <h2 id="customer-metrics-heading" className="sr-only">
        Métriques du client
      </h2>
      <div className="grid grid-cols-3 gap-4 sm:gap-6">
        <div className="text-center space-y-1">
          <p className="text-2xl font-bold tabular-nums">{totalSessions}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <ShoppingBag className="h-3 w-3" aria-hidden="true" />
            Sessions
          </p>
        </div>
        <div className="text-center border-x border-border space-y-1">
          <p className="text-2xl font-bold tabular-nums">{formatBytes(totalDataBytes)}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Database className="h-3 w-3" aria-hidden="true" />
            Data utilisée
          </p>
        </div>
        <div className="text-center space-y-1">
          <p className="text-2xl font-bold tabular-nums">{formatXof(totalSpentXof)}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
            Total dépensé
          </p>
        </div>
      </div>
    </section>
  );
}
