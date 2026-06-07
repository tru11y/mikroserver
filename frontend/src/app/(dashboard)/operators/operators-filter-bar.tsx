'use client';

import { Search } from 'lucide-react';
import type { SaasTier } from '@/lib/api/admin';
import type { StatusFilter } from './use-operators-page';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Tous les statuts' },
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'TRIAL', label: 'Essai' },
  { value: 'EXPIRED', label: 'Expiré' },
  { value: 'CANCELLED', label: 'Résilié' },
  { value: 'SUSPENDED', label: 'Suspendu' },
];

const selectClass =
  'bg-card border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface OperatorsFilterBarProps {
  search: string;
  tierFilter: string;
  statusFilter: StatusFilter;
  tiers: SaasTier[];
  resultCount: number;
  onSearch: (v: string) => void;
  onTierChange: (v: string) => void;
  onStatusChange: (v: StatusFilter) => void;
}

export function OperatorsFilterBar({
  search,
  tierFilter,
  statusFilter,
  tiers,
  resultCount,
  onSearch,
  onTierChange,
  onStatusChange,
}: OperatorsFilterBarProps) {
  return (
    <div
      className="flex flex-col gap-3 md:flex-row md:items-center"
      role="search"
      aria-label="Filtrer les opérateurs"
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Rechercher par nom ou email…"
          aria-label="Rechercher un opérateur"
          className="w-full rounded-xl border bg-card py-2 pl-9 pr-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </div>

      <select
        value={tierFilter}
        onChange={(e) => onTierChange(e.target.value)}
        aria-label="Filtrer par tier"
        className={selectClass}
      >
        <option value="ALL">Tous les tiers</option>
        {tiers
          .filter((t) => t.isActive)
          .map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name}
            </option>
          ))}
      </select>

      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
        aria-label="Filtrer par statut d'abonnement"
        className={selectClass}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <p
        className="shrink-0 text-xs text-muted-foreground md:ml-1"
        aria-live="polite"
        aria-atomic="true"
      >
        {resultCount} résultat{resultCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
