'use client';

import {
  AlertCircle,
  Clock,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { KpiCardSkeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { formatXof } from '@/lib/formatters';
import type { AccountingKpis } from './use-accounting-data';

const SECTION_ID = 'accounting-hero-heading';

interface KpiTile {
  label: string;
  value: string;
  icon: LucideIcon;
  tileClass: string;
  valueClass: string;
}

function buildTiles(kpis: AccountingKpis): KpiTile[] {
  return [
    {
      label: 'Total payé',
      value: formatXof(kpis.totalPaidXof),
      icon: CreditCard,
      tileClass: 'bg-success/10 text-success',
      valueClass: 'text-success',
    },
    {
      label: 'En attente',
      value: formatXof(kpis.totalPendingXof),
      icon: Clock,
      tileClass: 'bg-warning/10 text-warning',
      valueClass: 'text-warning',
    },
    {
      label: 'En retard',
      value: formatXof(kpis.totalOverdueXof),
      icon: AlertCircle,
      tileClass: 'bg-destructive/10 text-destructive',
      valueClass: 'text-destructive',
    },
    {
      label: 'Factures',
      value: String(kpis.invoiceCount),
      icon: FileText,
      tileClass: 'bg-primary/10 text-primary',
      valueClass: 'text-foreground',
    },
  ];
}

interface Props {
  kpis: AccountingKpis;
  isLoading: boolean;
  isError: boolean;
  isExporting: boolean;
  onRetry: () => void;
  onExport: () => void;
}

export function AccountingHeroSection({
  kpis,
  isLoading,
  isError,
  isExporting,
  onRetry,
  onExport,
}: Props) {
  return (
    <section aria-labelledby={SECTION_ID} className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            id={SECTION_ID}
            className="text-lg font-semibold tracking-tight flex items-center gap-2"
          >
            <Receipt className="h-5 w-5 text-primary" aria-hidden="true" />
            Comptabilité
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Revenus, factures et analyses financières
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          aria-label={isExporting ? 'Export en cours…' : 'Exporter les transactions en CSV'}
          className={clsx(
            'shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium',
            'transition-all duration-200 ease-out active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            isExporting
              ? 'cursor-not-allowed opacity-60'
              : 'hover:bg-muted',
          )}
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isExporting ? 'Export…' : 'Export CSV'}
        </button>
      </div>

      {isError ? (
        <ErrorState
          variant="inline"
          message="Impossible de charger les indicateurs."
          onRetry={onRetry}
        />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
            : buildTiles(kpis).map(({ label, value, icon: Icon, tileClass, valueClass }) => (
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
              ))}
        </div>
      )}
    </section>
  );
}
