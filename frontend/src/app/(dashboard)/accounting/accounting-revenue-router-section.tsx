'use client';

import { Router } from 'lucide-react';
import { TableRowSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { formatXof } from '@/lib/formatters';
import type { RevenueRouterRow } from '@/lib/api/accounting';

const SECTION_ID = 'accounting-router-heading';

interface Props {
  data: RevenueRouterRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function AccountingRevenueRouterSection({ data, isLoading, isError, onRetry }: Props) {
  const isEmpty = !isLoading && !isError && data.length === 0;

  return (
    <section aria-labelledby={SECTION_ID} className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b flex items-center gap-2">
        <Router className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 id={SECTION_ID} className="font-semibold text-sm">
          Revenus par routeur — 30 derniers jours
        </h2>
      </div>

      <div className="overflow-x-auto">
        {isLoading ? (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {['Routeur', 'Transactions', 'Revenus'].map((h) => (
                  <th
                    key={h}
                    className="px-4 md:px-6 py-3 text-left text-xs font-medium text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={3} />
              ))}
            </tbody>
          </table>
        ) : isError ? (
          <div className="p-6">
            <ErrorState onRetry={onRetry} />
          </div>
        ) : isEmpty ? (
          <div className="p-6">
            <EmptyState title="Aucune donnée de routeur" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-muted-foreground">
                  Routeur
                </th>
                <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-muted-foreground">
                  Transactions
                </th>
                <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-muted-foreground">
                  Revenus
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {data.map((row) => (
                <tr key={row.routerId} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 md:px-6 py-3 font-medium text-sm">{row.routerName}</td>
                  <td className="px-4 md:px-6 py-3 text-right text-muted-foreground text-sm tabular-nums">
                    {row.transactionCount}
                  </td>
                  <td className="px-4 md:px-6 py-3 text-right font-bold tabular-nums text-sm">
                    {formatXof(row.totalXof)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
