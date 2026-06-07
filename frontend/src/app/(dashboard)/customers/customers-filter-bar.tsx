'use client';

import { Search, X } from 'lucide-react';

interface Router {
  id: string;
  name: string;
}

interface CustomersFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  routerId: string;
  onRouterChange: (value: string) => void;
  routers: Router[];
}

export function CustomersFilterBar({
  search,
  onSearchChange,
  routerId,
  onRouterChange,
  routers,
}: CustomersFilterBarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher par MAC, nom, téléphone..."
          aria-label="Rechercher un client"
          className="w-full rounded-md border bg-background py-1.5 pl-9 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background border-input"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            aria-label="Effacer la recherche"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {routers.length > 0 && (
        <select
          value={routerId}
          onChange={(e) => onRouterChange(e.target.value)}
          aria-label="Filtrer par routeur"
          className="rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background border-input sm:w-44"
        >
          <option value="">Tous les routeurs</option>
          {routers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
