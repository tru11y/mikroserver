'use client';

import { Search, X } from 'lucide-react';

type RoleFilter = 'ALL' | 'SUPER_ADMIN' | 'ADMIN' | 'RESELLER' | 'VIEWER';
type StatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export function ResellersFilterBar({
  roleFilter,
  statusFilter,
  searchFilter,
  resultCount,
  onRoleChange,
  onStatusChange,
  onSearchChange,
}: {
  roleFilter: RoleFilter;
  statusFilter: StatusFilter;
  searchFilter: string;
  resultCount: number;
  onRoleChange: (value: RoleFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
  onSearchChange: (value: string) => void;
}) {
  return (
    <section id="filters" aria-labelledby="filters-heading" className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h2 id="filters-heading" className="font-semibold">Filtres &amp; recherche</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Retrouve rapidement un compte par nom, rôle ou statut.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5 xl:col-span-2">
          <label htmlFor="resellers-search" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recherche
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="resellers-search"
              type="search"
              value={searchFilter}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Nom, email, téléphone, rôle ou profil..."
              className="w-full rounded-lg border bg-background py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
            {searchFilter ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="resellers-role" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rôle
          </label>
          <select
            id="resellers-role"
            value={roleFilter}
            onChange={(e) => onRoleChange(e.target.value as RoleFilter)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          >
            <option value="ALL">Tous les rôles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="RESELLER">Revendeur</option>
            <option value="VIEWER">Lecture seule</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="resellers-status" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Statut
          </label>
          <select
            id="resellers-status"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="SUSPENDED">Suspendu</option>
            <option value="PENDING_VERIFICATION">En attente</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
        {resultCount} résultat{resultCount !== 1 ? 's' : ''} visible{resultCount !== 1 ? 's' : ''} après filtres.
      </div>
    </section>
  );
}
