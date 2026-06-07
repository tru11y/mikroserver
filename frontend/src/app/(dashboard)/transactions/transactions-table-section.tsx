'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { clsx } from 'clsx';
import { TransactionStatusBadge } from '@/components/ui/transaction-status-badge';
import { CopyableRef } from '@/components/ui/copyable-ref';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { formatXof } from '@/lib/formatters';
import type { Transaction } from './transaction.types';

interface TransactionsTableSectionProps {
  transactions: Transaction[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return 'Vente manuelle';
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-2)}`;
}

function TransactionCard({ tx }: { tx: Transaction }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border bg-card/60 p-3.5 hover:bg-muted/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium truncate">
            {maskPhone(tx.customerPhone)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {tx.plan?.name ?? '—'}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold tabular-nums">
            {formatXof(tx.amountXof)}
          </p>
          <p
            className="text-[11px] text-muted-foreground tabular-nums"
            title={formatDistanceToNow(new Date(tx.createdAt), {
              addSuffix: true,
              locale: fr,
            })}
          >
            {format(new Date(tx.createdAt), 'dd/MM/yy HH:mm', { locale: fr })}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <TransactionStatusBadge status={tx.status} />
        {tx.externalReference ? (
          <CopyableRef value={tx.externalReference} truncate={16} />
        ) : (
          <span className="font-mono text-[11px] text-muted-foreground">
            {tx.reference.slice(0, 16)}
          </span>
        )}
      </div>
    </article>
  );
}

function MobileCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card/60 p-3.5 space-y-2.5">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export function TransactionsTableSection({
  transactions,
  isLoading,
  isError,
  onRetry,
  page,
  totalPages,
  total,
  onPageChange,
}: TransactionsTableSectionProps) {
  if (isError) {
    return (
      <ErrorState
        title="Impossible de charger les transactions"
        message="Vérifiez votre connexion et réessayez."
        onRetry={onRetry}
      />
    );
  }

  return (
    <section aria-labelledby="transactions-table-heading" className="space-y-3">
      <h2 id="transactions-table-heading" className="sr-only">
        Liste des transactions
      </h2>

      {/* ── Mobile : cards empilées ─────────────────────────────────────── */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <MobileCardSkeleton key={i} />
          ))
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-5 w-5" />}
            title="Aucune transaction"
            description="Les transactions apparaîtront ici selon vos filtres."
          />
        ) : (
          transactions.map((tx) => <TransactionCard key={tx.id} tx={tx} />)
        )}
      </div>

      {/* ── Desktop : table ─────────────────────────────────────────────── */}
      <div className="hidden md:block rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              {(
                [
                  ['Date',      false],
                  ['Client',    false],
                  ['Forfait',   false],
                  ['Montant',   true ],
                  ['Statut',    false],
                  ['Réf. Wave', false],
                ] as [string, boolean][]
              ).map(([label, alignRight]) => (
                <th
                  key={label}
                  scope="col"
                  className={clsx(
                    'px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider',
                    alignRight ? 'text-right' : 'text-left',
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={6} />
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12">
                  <EmptyState
                    icon={<CreditCard className="h-5 w-5" />}
                    title="Aucune transaction"
                    description="Les transactions apparaîtront ici selon vos filtres."
                  />
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p
                      className="text-xs tabular-nums"
                      title={formatDistanceToNow(new Date(tx.createdAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    >
                      {format(new Date(tx.createdAt), 'dd/MM/yyyy', {
                        locale: fr,
                      })}
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {format(new Date(tx.createdAt), 'HH:mm', { locale: fr })}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <p className="text-xs font-medium">
                      {maskPhone(tx.customerPhone)}
                    </p>
                    {tx.customerName && (
                      <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                        {tx.customerName}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {tx.plan?.name ?? '—'}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatXof(tx.amountXof)}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <TransactionStatusBadge status={tx.status} />
                  </td>

                  <td className="px-4 py-3">
                    {tx.externalReference ? (
                      <CopyableRef
                        value={tx.externalReference}
                        truncate={16}
                      />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {!isLoading && total > 0 && (
        <nav
          aria-label="Pagination des transactions"
          className="flex items-center justify-between px-1"
        >
          <span className="text-xs text-muted-foreground tabular-nums">
            {total} résultat{total !== 1 ? 's' : ''} · page{' '}
            {page}/{Math.max(1, totalPages)}
          </span>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              aria-label="Page précédente"
              className="inline-flex items-center justify-center h-7 w-7 rounded-md border hover:bg-muted active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              aria-label="Page suivante"
              className="inline-flex items-center justify-center h-7 w-7 rounded-md border hover:bg-muted active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
