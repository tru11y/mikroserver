'use client';

import { Download, UserPlus, Users, Wifi } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CustomerStats {
  total: number;
  newThisWeek: number;
  activeThisWeek: number;
}

interface CustomersHeroSectionProps {
  stats: CustomerStats | undefined;
  isLoading: boolean;
}

const SECTION_ID = 'customers-hero-heading';

export function CustomersHeroSection({ stats, isLoading }: CustomersHeroSectionProps) {
  return (
    <section aria-labelledby={SECTION_ID} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id={SECTION_ID} className="text-lg font-semibold tracking-tight">
            Clients
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Profils WiFi identifiés par adresse MAC
          </p>
        </div>
        <a
          href="/proxy/api/v1/export/customers"
          download
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50 active:scale-[0.98] transition-all duration-200 ease-out self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export CSV
        </a>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {isLoading || !stats ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-3">
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="rounded-lg border bg-card p-3 hover:border-primary/30 hover:shadow-[var(--shadow-md)] transition-all duration-200 ease-out">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Total
                </p>
                <div className="h-6 w-6 rounded-md flex items-center justify-center bg-muted text-foreground">
                  <Users className="h-3 w-3" aria-hidden="true" />
                </div>
              </div>
              <p className="text-xl font-bold tabular-nums leading-none">{stats.total}</p>
            </div>

            <div className="rounded-lg border bg-card p-3 hover:border-primary/30 hover:shadow-[var(--shadow-md)] transition-all duration-200 ease-out">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Nouveaux
                </p>
                <div className="h-6 w-6 rounded-md flex items-center justify-center bg-success/10 text-success">
                  <UserPlus className="h-3 w-3" aria-hidden="true" />
                </div>
              </div>
              <p className="text-xl font-bold tabular-nums leading-none text-success">
                +{stats.newThisWeek}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">cette semaine</p>
            </div>

            <div className="rounded-lg border bg-card p-3 hover:border-primary/30 hover:shadow-[var(--shadow-md)] transition-all duration-200 ease-out">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Actifs
                </p>
                <div className="h-6 w-6 rounded-md flex items-center justify-center bg-primary/10 text-primary">
                  <Wifi className="h-3 w-3" aria-hidden="true" />
                </div>
              </div>
              <p className="text-xl font-bold tabular-nums leading-none text-primary">
                {stats.activeThisWeek}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">cette semaine</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
