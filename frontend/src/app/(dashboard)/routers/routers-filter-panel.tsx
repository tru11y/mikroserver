'use client';

import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { RouterStatus } from './routers.types';

const STATUS_PILLS: Array<{ value: 'ALL' | RouterStatus; label: string }> = [
  { value: 'ALL',         label: 'Tous'         },
  { value: 'ONLINE',      label: 'En ligne'     },
  { value: 'DEGRADED',    label: 'Dégradés'     },
  { value: 'OFFLINE',     label: 'Hors ligne'   },
  { value: 'MAINTENANCE', label: 'Maintenance'  },
];

const selectClass =
  'flex-1 min-w-0 rounded-md border bg-background px-3 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] cursor-pointer';

interface RoutersFilterPanelProps {
  searchFilter: string;
  statusFilter: 'ALL' | RouterStatus;
  siteFilter: string;
  tagFilter: string;
  siteOptions: string[];
  tagOptions: string[];
  resultCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: 'ALL' | RouterStatus) => void;
  onSiteChange: (value: string) => void;
  onTagChange: (value: string) => void;
}

export function RoutersFilterPanel({
  searchFilter,
  statusFilter,
  siteFilter,
  tagFilter,
  siteOptions,
  tagOptions,
  resultCount,
  hasActiveFilters,
  onSearchChange,
  onStatusChange,
  onSiteChange,
  onTagChange,
}: RoutersFilterPanelProps) {
  const clearAll = () => {
    onSearchChange('');
    onStatusChange('ALL');
    onSiteChange('');
    onTagChange('');
  };

  return (
    <section aria-label="Filtres de la flotte" className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={searchFilter}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Nom, IP, site, tag..."
            aria-label="Rechercher un routeur"
            className="w-full rounded-md border bg-background py-1.5 pl-9 pr-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          />
          {searchFilter && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              aria-label="Effacer la recherche"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div
          role="group"
          aria-label="Filtrer par statut"
          className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0"
        >
          {STATUS_PILLS.map((p) => {
            const active = statusFilter === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onStatusChange(p.value)}
                aria-current={active ? 'true' : undefined}
                className={clsx(
                  'rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-0 flex gap-2">
          <select
            value={siteFilter}
            onChange={(e) => onSiteChange(e.target.value)}
            aria-label="Filtrer par site"
            className={selectClass}
          >
            <option value="">Tous les sites</option>
            {siteOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={tagFilter}
            onChange={(e) => onTagChange(e.target.value)}
            aria-label="Filtrer par tag"
            className={selectClass}
          >
            <option value="">Tous les tags</option>
            {tagOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <span className="tabular-nums">
            {resultCount} résultat{resultCount !== 1 ? 's' : ''}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-primary hover:bg-primary/10 active:scale-[0.98] transition-all duration-200 ease-out font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Réinitialiser
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
