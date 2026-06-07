'use client';

import { Clock, Crown, Plus, Shield, TrendingUp, Users } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { KpiCardSkeleton } from '@/components/ui/skeleton';
import { formatXof } from '@/lib/formatters';

interface OperatorsHeroSectionProps {
  total: number;
  active: number;
  expiringSoon: number;
  revenueThisMonth: number;
  isLoading: boolean;
  canProvision: boolean;
  onProvision: () => void;
}

export function OperatorsHeroSection({
  total,
  active,
  expiringSoon,
  revenueThisMonth,
  isLoading,
  canProvision,
  onProvision,
}: OperatorsHeroSectionProps) {
  return (
    <section aria-labelledby="operators-title" className="space-y-5">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary)/0.1)] px-3 py-1 text-xs font-medium text-[hsl(var(--primary))]">
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              Console SUPER_ADMIN
            </div>
            <h1
              id="operators-title"
              className="mt-3 text-3xl font-bold tracking-tight"
            >
              Opérateurs
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Gestion multi-tenant — comptes, abonnements SaaS et métriques par opérateur.
            </p>
          </div>

          {canProvision && (
            <button
              type="button"
              onClick={onProvision}
              aria-label="Créer un nouvel opérateur"
              className="inline-flex items-center gap-2 self-start rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-all duration-200 ease-out hover:bg-[hsl(var(--primary-hover))] hover:[box-shadow:var(--shadow-glow)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background xl:self-auto"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouvel opérateur
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              title="Total opérateurs"
              value={String(total)}
              icon={<Users className="h-4 w-4" />}
              variant="primary"
            />
            <KpiCard
              title="Abonnements actifs"
              value={String(active)}
              icon={<Crown className="h-4 w-4" />}
              variant="success"
            />
            <KpiCard
              title="Expirent < 7 j"
              value={String(expiringSoon)}
              icon={<Clock className="h-4 w-4" />}
              variant={expiringSoon > 0 ? 'warning' : 'neutral'}
              trend={
                expiringSoon > 0
                  ? { value: expiringSoon, label: 'renouvellements urgents', alert: true }
                  : undefined
              }
            />
            <KpiCard
              title="Revenu ce mois"
              value={formatXof(revenueThisMonth)}
              icon={<TrendingUp className="h-4 w-4" />}
              variant="neutral"
            />
          </>
        )}
      </div>
    </section>
  );
}
