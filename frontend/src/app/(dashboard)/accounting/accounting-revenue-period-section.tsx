'use client';

import { Calendar } from 'lucide-react';
import { ChartSkeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { AccountingPeriodBarChart } from '@/components/charts/lazy';
import { formatXof } from '@/lib/formatters';
import type { RevenuePeriodRow } from '@/lib/api/accounting';

const SECTION_ID = 'accounting-period-heading';

interface Props {
  data: RevenuePeriodRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function AccountingRevenuePeriodSection({ data, isLoading, isError, onRetry }: Props) {
  const isEmpty = !isLoading && !isError && data.length === 0;

  return (
    <section aria-labelledby={SECTION_ID} className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 id={SECTION_ID} className="font-semibold text-sm">
          Revenus des 6 derniers mois
        </h2>
      </div>

      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="space-y-4">
            <ChartSkeleton rows={6} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={3} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : isEmpty ? (
          <EmptyState title="Aucune donnée de revenus" />
        ) : (
          <div className="space-y-4">
            <AccountingPeriodBarChart data={data} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left pb-2 text-xs font-medium text-muted-foreground">
                      Période
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
                      key={`${row.year}-${row.monthNum}`}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-3 capitalize font-medium text-sm">
                        {row.month} {row.year}
                      </td>
                      <td className="py-3 text-right text-muted-foreground text-sm tabular-nums">
                        {row.transactionCount}
                      </td>
                      <td className="py-3 text-right font-bold tabular-nums text-sm">
                        {formatXof(row.totalXof)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
