'use client';

import { Search } from 'lucide-react';

export function ResellersFilterBar({
  roleFilter,
  statusFilter,
  searchFilter,
  resultCount,
  onRoleChange,
  onStatusChange,
  onSearchChange,
}: {
  roleFilter: 'ALL' | 'SUPER_ADMIN' | 'ADMIN' | 'RESELLER' | 'VIEWER';
  statusFilter: 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  searchFilter: string;
  resultCount: number;
  onRoleChange: (value: 'ALL' | 'SUPER_ADMIN' | 'ADMIN' | 'RESELLER' | 'VIEWER') => void;
  onStatusChange: (value: 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION') => void;
  onSearchChange: (value: string) => void;
}) {
  return (
    <section id="filters" className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Filtres & recherche</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Retrouve rapidement un compte, un role ou un statut sans parcourir tout le tableau.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1.5 xl:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recherche
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchFilter}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Nom, email, telephone, role ou profil..."
              className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Role
          </span>
          <select
            value={roleFilter}
            onChange={(event) =>
              onRoleChange(
                event.target.value as 'ALL' | 'SUPER_ADMIN' | 'ADMIN' | 'RESELLER' | 'VIEWER',
              )
            }
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">Tous les roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="RESELLER">Revendeur</option>
            <option value="VIEWER">Lecture seule</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Statut
          </span>
          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusChange(
                event.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION',
              )
            }
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="SUSPENDED">Suspendu</option>
            <option value="PENDING_VERIFICATION">En attente</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
        {resultCount} resultat{resultCount !== 1 ? 's' : ''} visible{resultCount !== 1 ? 's' : ''}
        {' '}apres filtres.
      </div>
    </section>
  );
}
