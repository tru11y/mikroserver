import { CheckCircle2, Clock, CreditCard, XCircle, type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { KpiCardSkeleton } from '@/components/ui/skeleton';
import { formatXof } from '@/lib/formatters';
import type { TransactionSummary } from './transaction.types';

const SECTION_ID = 'transactions-hero-heading';

interface TransactionsHeroSectionProps {
  summary: TransactionSummary | null;
  isLoading: boolean;
  isError?: boolean;
}

interface KpiTile {
  label: string;
  value: string;
  icon: LucideIcon;
  tileClass: string;
  valueClass: string;
}

function buildTiles(s: TransactionSummary): KpiTile[] {
  return [
    {
      label: 'Total encaissé',
      value: formatXof(s.totalXof),
      icon: CreditCard,
      tileClass: 'bg-primary/10 text-primary',
      valueClass: 'text-primary',
    },
    {
      label: 'Complétées',
      value: String(s.completedCount),
      icon: CheckCircle2,
      tileClass: 'bg-success/10 text-success',
      valueClass: 'text-success',
    },
    {
      label: 'En attente',
      value: String(s.pendingCount + s.processingCount),
      icon: Clock,
      tileClass: 'bg-warning/10 text-warning',
      valueClass: 'text-warning',
    },
    {
      label: 'Échouées',
      value: String(s.failedCount),
      icon: XCircle,
      tileClass: 'bg-destructive/10 text-destructive',
      valueClass: 'text-destructive',
    },
  ];
}

export function TransactionsHeroSection({
  summary,
  isLoading,
  isError = false,
}: TransactionsHeroSectionProps) {
  return (
    <section aria-labelledby={SECTION_ID} className="space-y-3">
      <div>
        <h1
          id={SECTION_ID}
          className="text-lg font-semibold tracking-tight"
        >
          Transactions
        </h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Historique des paiements Wave CI
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : isError || !summary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border bg-card p-3 flex items-center justify-center h-[72px]"
            >
              <span className="text-[11px] text-muted-foreground">—</span>
            </div>
          ))
        ) : (
          buildTiles(summary).map(({ label, value, icon: Icon, tileClass, valueClass }) => (
            <div
              key={label}
              className="rounded-lg border bg-card p-3 hover:border-primary/30 hover:shadow-[var(--shadow-md)] transition-all duration-200 ease-out"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
                  {label}
                </p>
                <div
                  className={clsx(
                    'h-6 w-6 rounded-md flex items-center justify-center shrink-0',
                    tileClass,
                  )}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                </div>
              </div>
              <p
                className={clsx(
                  'text-xl font-bold tracking-tight tabular-nums leading-none',
                  valueClass,
                )}
              >
                {value}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
