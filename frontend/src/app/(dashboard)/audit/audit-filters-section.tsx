'use client';

import { useState } from 'react';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { clsx } from 'clsx';
import { PeriodShortcut, type PeriodOption } from '@/components/ui/period-shortcut';

export interface AuditFilters {
  search: string;
  action: string;
  entityType: string;
  startDate: string;
  endDate: string;
  activePeriodKey: string;
}

interface AuditFiltersSectionProps {
  filters: AuditFilters;
  availableActions: string[];
  availableEntityTypes: string[];
  onChange: (patch: Partial<AuditFilters>) => void;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { key: '1j', label: '1J', days: 1 },
  { key: '7j', label: '7J', days: 7 },
  { key: '30j', label: '30J', days: 30 },
];

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function countActiveFilters(filters: AuditFilters): number {
  let n = 0;
  if (filters.search) n++;
  if (filters.action) n++;
  if (filters.entityType) n++;
  return n;
}

export function AuditFiltersSection({
  filters,
  availableActions,
  availableEntityTypes,
  onChange,
}: AuditFiltersSectionProps) {
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  const handlePeriod = (opt: PeriodOption) => {
    const end = new Date();
    const start = new Date(end.getTime() - (opt.days - 1) * 24 * 60 * 60 * 1000);
    onChange({
      startDate: formatDateInput(start),
      endDate: formatDateInput(end),
      activePeriodKey: opt.key,
    });
  };

  const inputClass =
    'w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

  return (
    <section
      aria-label="Filtres de recherche"
      className="rounded-xl border border-border/60 bg-card/80 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Filter className="h-4 w-4 text-primary" aria-hidden="true" />
          Filtres
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {activeCount}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({ search: '', action: '', entityType: '' })}
              className="text-xs text-muted-foreground transition-all duration-200 ease-out active:scale-[0.95] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:rounded"
              aria-label="Réinitialiser les filtres"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden rounded-lg border border-border/60 p-1.5 text-muted-foreground transition-all duration-200 ease-out active:scale-[0.95] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            aria-expanded={open}
            aria-controls="audit-filters-panel"
            aria-label={open ? 'Masquer les filtres' : 'Afficher les filtres'}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        id="audit-filters-panel"
        className={clsx('mt-4', open ? 'block' : 'hidden', 'lg:block')}
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_minmax(140px,auto)_minmax(140px,auto)_auto_auto_auto]">
          {/* Recherche */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="audit-search" className="sr-only">
              Rechercher dans les logs
            </label>
            <input
              id="audit-search"
              type="search"
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
              placeholder="Description, acteur, IP, requestId…"
              className={clsx(inputClass, 'pl-9')}
            />
          </div>

          {/* Action */}
          <div>
            <label htmlFor="audit-action" className="sr-only">
              Filtrer par action
            </label>
            <select
              id="audit-action"
              value={filters.action}
              onChange={(e) => onChange({ action: e.target.value })}
              className={inputClass}
            >
              <option value="">Toutes actions</option>
              {availableActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Type d'entité */}
          <div>
            <label htmlFor="audit-entity-type" className="sr-only">
              Filtrer par type d&apos;entité
            </label>
            <select
              id="audit-entity-type"
              value={filters.entityType}
              onChange={(e) => onChange({ entityType: e.target.value })}
              className={inputClass}
            >
              <option value="">Tous types</option>
              {availableEntityTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Date début */}
          <div>
            <label htmlFor="audit-start-date" className="sr-only">
              Date de début
            </label>
            <input
              id="audit-start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                onChange({ startDate: e.target.value, activePeriodKey: '' })
              }
              className={inputClass}
            />
          </div>

          {/* Date fin */}
          <div>
            <label htmlFor="audit-end-date" className="sr-only">
              Date de fin
            </label>
            <input
              id="audit-end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                onChange({ endDate: e.target.value, activePeriodKey: '' })
              }
              className={inputClass}
            />
          </div>

          {/* Raccourcis période */}
          <div className="flex items-center">
            <PeriodShortcut
              options={PERIOD_OPTIONS}
              activeKey={filters.activePeriodKey}
              onChange={handlePeriod}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
