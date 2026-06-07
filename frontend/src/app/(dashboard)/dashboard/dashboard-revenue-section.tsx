'use client';

import Link from 'next/link';
import { RevenueChart, TopRoutersChart } from '@/components/charts/lazy';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { formatXof } from '@/lib/formatters';
import { TrendingUp, Users } from 'lucide-react';

interface TopRouter {
  id:       string;
  name:     string;
  revenue:  number;
  sessions: number;
}

interface DashboardRevenueSectionProps {
  topRouters: TopRouter[];
  isLoading:  boolean;
  isError?:   boolean;
  onRetry?:   () => void;
}

export function DashboardRevenueSection({
  topRouters,
  isLoading,
  isError,
  onRetry,
}: DashboardRevenueSectionProps) {
  return (
    <section aria-labelledby="revenue-heading" className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <RevenueChart />
      </div>

      <div className="lg:col-span-2">
        <div className="rounded-xl border bg-card p-5 h-full flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 id="revenue-heading" className="font-semibold text-sm">Top routeurs · 30j</h3>
              <p className="text-[11px] text-muted-foreground">Par revenus générés</p>
            </div>
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {isError ? (
            <ErrorState
              variant="inline"
              title="Données indisponibles"
              onRetry={onRetry}
            />
          ) : isLoading ? (
            <div className="space-y-2 flex-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 rounded" />
              ))}
            </div>
          ) : topRouters.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground py-6">
              <Users className="h-7 w-7 opacity-30" />
              <p className="text-xs">Aucune donnée</p>
            </div>
          ) : (
            <>
              <TopRoutersChart data={topRouters} />
              <div className="mt-3 space-y-0.5 border-t pt-2">
                {topRouters.map((router) => (
                  <Link
                    key={router.id}
                    href={`/routers/${router.id}`}
                    className="flex items-center justify-between py-1.5 text-xs rounded-md px-2 hover:bg-muted/50 active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="font-medium truncate max-w-[140px]">{router.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-muted-foreground tabular-nums">{router.sessions} sess.</span>
                      <span className="font-semibold tabular-nums">{formatXof(router.revenue)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
