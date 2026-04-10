'use client';

import { Search, SlidersHorizontal } from 'lucide-react';
import { STATUS_OPTIONS } from './routers.utils';
import type { RouterStatus } from './routers.types';

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
  return (
    <section id="fleet-filters" className="rounded-[28px] border bg-card/90 p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Recherche terrain
          </p>
          <h2 className="mt-2 text-lg font-semibold">Filtres & contexte de flotte</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Trouve un site, une IP, un tag ou un statut sans perdre la lecture globale.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {resultCount} resultat{resultCount !== 1 ? 's' : ''} visible
          {resultCount !== 1 ? 's' : ''}
          {hasActiveFilters ? ' avec filtres actifs' : ''}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1.5 xl:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recherche
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchFilter}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Nom, IP WireGuard, site, tag ou serveur hotspot..."
              className="w-full rounded-2xl border bg-background py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Statut
          </span>
          <select
            value={statusFilter}
            onChange={(event) => onStatusChange(event.target.value as 'ALL' | RouterStatus)}
            className="w-full rounded-2xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Site
          </span>
          <input
            list="router-sites"
            value={siteFilter}
            onChange={(event) => onSiteChange(event.target.value)}
            placeholder="Tous les sites"
            className="w-full rounded-2xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <datalist id="router-sites">
            {siteOptions.map((site) => (
              <option key={site} value={site} />
            ))}
          </datalist>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tag
          </span>
          <input
            list="router-tags"
            value={tagFilter}
            onChange={(event) => onTagChange(event.target.value)}
            placeholder="Tous les tags"
            className="w-full rounded-2xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <datalist id="router-tags">
            {tagOptions.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </label>
      </div>
    </section>
  );
}
