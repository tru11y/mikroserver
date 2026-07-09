'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { accountingApi } from '@/lib/api/accounting';
import { ChartSkeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { AccountingPeriodBarChart } from '@/components/charts/lazy';
import { formatXof } from '@/lib/formatters';
import type { RevenuePeriodRow } from '@/lib/api/accounting';

const SECTION_ID = 'accounting-period-heading';
const MIN_YEAR = 2020;

export function AccountingRevenuePeriodSection() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: raw, isLoading, isError, refetch } = useQuery({
    queryKey: ['accounting', 'revenue-year', selectedYear],
    queryFn: () => accountingApi.getRevenueByYear({ year: selectedYear }),
    staleTime: 5 * 60 * 1000,
  });

  const data: RevenuePeriodRow[] =
    (raw?.data as { data: RevenuePeriodRow[] } | undefined)?.data ?? [];

  const isEmpty = !isLoading && !isError && data.every((r) => r.totalXof === 0);
  const totalXof = data.reduce((s, r) => s + r.totalXof, 0);
  const bestMonth = data.reduce<RevenuePeriodRow | null>(
    (best, r) => (best === null || r.totalXof > best.totalXof ? r : best),
    null,
  );
  const avgXof = Math.round(totalXof / 12);

  return (
    <section aria-labelledby={SECTION_ID} className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 id={SECTION_ID} className="font-semibold text-sm">
            Revenus mensuels
          </h2>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Sélection de l'année">
          <button
            type="button"
            onClick={() => setSelectedYear((y) => Math.max(MIN_YEAR, y - 1))}
            disabled={selectedYear <= MIN_YEAR}
            aria-label="Année précédente"
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span
            className="tabular-nums font-semibold text-sm w-12 text-center"
            aria-live="polite"
            aria-atomic="true"
          >
            {selectedYear}
          </span>
          <button
            type="button"
            onClick={() => setSelectedYear((y) => Math.min(currentYear, y + 1))}
            disabled={selectedYear >= currentYear}
            aria-label="Année suivante"
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="space-y-4">
            <ChartSkeleton rows={6} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={3} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : isEmpty ? (
          <EmptyState title={`Aucun revenu enregistré en ${selectedYear}`} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Total annuel
                </p>
                <p className="font-bold tabular-nums text-sm">{formatXof(totalXof)}</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Moy. mensuelle
                </p>
                <p className="font-bold tabular-nums text-sm">{formatXof(avgXof)}</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Meilleur mois
                </p>
                <p className="font-bold tabular-nums text-sm capitalize truncate">
                  {bestMonth ? bestMonth.month : '—'}
                </p>
              </div>
            </div>

            <AccountingPeriodBarChart data={data} />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left pb-2 text-xs font-medium text-muted-foreground">
                      Mois
                    </th>
                    <th className="text-right pb-2 text-xs font-medium text-muted-foreground">
                      Transactions
                    </th>
                    <th className="text-right pb-2 text-xs font-medium text-muted-foreground">
                      Revenus
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.map((row) => (
                    <tr
                      key={row.monthNum}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-2.5 capitalize font-medium text-sm">{row.month}</td>
                      <td className="py-2.5 text-right text-muted-foreground text-sm tabular-nums">
                        {row.transactionCount}
                      </td>
                      <td
                        className={`py-2.5 text-right font-bold tabular-nums text-sm ${
                          row.totalXof === 0 ? 'text-muted-foreground/50' : ''
                        }`}
                      >
                        {formatXof(row.totalXof)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border">
                    <td className="pt-2.5 text-xs font-semibold text-muted-foreground">
                      Total {selectedYear}
                    </td>
                    <td className="pt-2.5 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                      {data.reduce((s, r) => s + r.transactionCount, 0)}
                    </td>
                    <td className="pt-2.5 text-right text-sm font-bold tabular-nums">
                      {formatXof(totalXof)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
