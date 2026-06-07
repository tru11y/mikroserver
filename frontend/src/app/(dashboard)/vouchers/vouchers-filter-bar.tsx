'use client';

import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';

const STATUS_PILLS = [
  { value: 'ALL',             label: 'Tous'       },
  { value: 'GENERATED',       label: 'Générés'    },
  { value: 'DELIVERED',       label: 'Livrés'     },
  { value: 'ACTIVE',          label: 'Actifs'     },
  { value: 'EXPIRED',         label: 'Expirés'    },
  { value: 'REVOKED',         label: 'Révoqués'   },
  { value: 'DELIVERY_FAILED', label: 'Échec'      },
] as const;

const USAGE_PILLS = [
  { value: 'ALL',    label: 'Tout'            },
  { value: 'UNUSED', label: 'Jamais utilisés' },
  { value: 'READY',  label: 'Prêts à vendre'  },
  { value: 'USED',   label: 'Utilisés'        },
  { value: 'ISSUES', label: 'En problème'     },
] as const;

interface VouchersFilterBarProps {
  search: string;
  statusFilter: string;
  usageFilter: string;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onUsageChange: (v: string) => void;
  onReset: () => void;
}

export function VouchersFilterBar({
  search,
  statusFilter,
  usageFilter,
  onSearchChange,
  onStatusChange,
  onUsageChange,
  onReset,
}: VouchersFilterBarProps) {
  const hasActiveFilters = statusFilter !== 'ALL' || usageFilter !== 'ALL' || search.trim() !== '';

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher code, forfait, routeur..."
            aria-label="Rechercher des tickets"
            className="w-full rounded-md border bg-background py-1.5 pl-9 pr-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-primary/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Effacer la recherche"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-all duration-200 ease-out hover:bg-muted hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary transition-all duration-200 ease-out hover:bg-primary/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background shrink-0"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Réinitialiser
          </button>
        )}
      </div>

      <PillRow label="Statut" pills={STATUS_PILLS} active={statusFilter} onChange={onStatusChange} />
      <PillRow label="Usage"  pills={USAGE_PILLS}  active={usageFilter}  onChange={onUsageChange}  />
    </div>
  );
}

function PillRow({
  label,
  pills,
  active,
  onChange,
}: {
  label: string;
  pills: ReadonlyArray<{ value: string; label: string }>;
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 overflow-x-auto -mx-1 px-1"
      role="group"
      aria-label={`Filtrer par ${label.toLowerCase()}`}
    >
      <span className="shrink-0 pr-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" aria-hidden="true">
        {label}
      </span>
      {pills.map((p) => {
        const isActive = active === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            aria-pressed={isActive ? 'true' : 'false'}
            className={clsx(
              'whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
