'use client';

import { clsx } from 'clsx';
import {
  DEFAULT_PERIOD_OPTIONS,
  PeriodShortcut,
  type PeriodOption,
} from '@/components/ui/period-shortcut';
import type { TransactionStatusFilter } from './transaction.types';

const STATUS_FILTERS: { key: TransactionStatusFilter; label: string }[] = [
  { key: 'ALL',        label: 'Tout'        },
  { key: 'COMPLETED',  label: 'Complétées'  },
  { key: 'PENDING',    label: 'En attente'  },
  { key: 'PROCESSING', label: 'Traitement'  },
  { key: 'FAILED',     label: 'Échouées'    },
  { key: 'REFUNDED',   label: 'Remboursées' },
];

const PERIOD_OPTIONS: PeriodOption[] = [
  ...DEFAULT_PERIOD_OPTIONS,
  { key: 'ALL', label: 'Tout', days: 0 },
];

interface TransactionsFiltersProps {
  status: TransactionStatusFilter;
  period: string;
  onStatusChange: (status: TransactionStatusFilter) => void;
  onPeriodChange: (option: PeriodOption) => void;
}

export function TransactionsFilters({
  status,
  period,
  onStatusChange,
  onPeriodChange,
}: TransactionsFiltersProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div role="group" aria-label="Filtrer par statut" className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onStatusChange(f.key)}
            aria-pressed={status === f.key}
            className={clsx(
              'rounded-md px-2.5 py-1 text-xs font-medium',
              'transition-all duration-200 ease-out active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              status === f.key
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'border border-border/60 bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <PeriodShortcut
        options={PERIOD_OPTIONS}
        activeKey={period}
        onChange={onPeriodChange}
      />
    </div>
  );
}
