'use client';

import Link from 'next/link';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { formatXof } from '@/lib/formatters';
import {
  Banknote,
  Activity,
  Radio,
  CheckCircle2,
  UserPlus,
  Ticket,
} from 'lucide-react';

interface DashboardKpis {
  revenue:      { today: number; thisMonth: number; last30Days: number; total: number };
  transactions: { today: number; thisMonth: number; successRate: number; pending: number };
  vouchers:     { activeToday: number; deliveryFailures: number };
  routers:      { online: number; offline: number; total: number };
  customers:    { uniqueToday: number; uniqueThisMonth: number };
}

interface SessionsResult {
  items:               unknown[];
  routerErrors:        unknown[];
  totalRouters:        number;
  respondingRouters:   number;
}

interface CustomerStats {
  total:          number;
  newThisWeek:    number;
  activeThisWeek: number;
}

interface DashboardHeroSectionProps {
  kpis:               DashboardKpis | undefined;
  liveCount:          number | null;
  liveResult:         SessionsResult | undefined;
  customerStats:      CustomerStats | undefined;
  isLoading:          boolean;
  isLoadingLive:      boolean;
  isError?:           boolean;
  onRetry?:           () => void;
}

export function DashboardHeroSection({
  kpis,
  liveCount,
  liveResult,
  customerStats,
  isLoading,
  isLoadingLive,
  isError,
  onRetry,
}: DashboardHeroSectionProps) {
  const routerOffline  = kpis?.routers.offline ?? 0;
  const successRate    = kpis?.transactions.successRate ?? 0;
  const liveValue      = isLoadingLive && liveCount === null ? '…' : String(liveCount ?? 0);

  return (
    <header>
      {/* ── Mobile-only revenue banner ─────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tableau de bord</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Mis à jour toutes les 30 s</p>
        </div>
        <Link
          href="/vouchers/generate"
          className="md:hidden inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Ticket className="h-3.5 w-3.5" />
          Générer
        </Link>
      </div>

      <div className="block sm:hidden rounded-lg p-4 relative overflow-hidden bg-primary text-primary-foreground mb-4">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/70 mb-1">
          Revenus aujourd&apos;hui
        </p>
        <p className="text-2xl font-bold tracking-tight tabular-nums mb-3">
          {formatXof(kpis?.revenue.today ?? 0)}
        </p>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-base font-bold leading-none tabular-nums">{liveCount ?? 0}</p>
            <p className="text-[10px] text-primary-foreground/70 mt-0.5">sessions</p>
          </div>
          <div className="w-px h-7 bg-white/20" />
          <div>
            <p className="text-base font-bold leading-none tabular-nums">
              {kpis?.routers.online ?? 0}/{kpis?.routers.total ?? 0}
            </p>
            <p className="text-[10px] text-primary-foreground/70 mt-0.5">routeurs</p>
          </div>
          <div className="w-px h-7 bg-white/20" />
          <div>
            <p className="text-base font-bold leading-none tabular-nums">{kpis?.vouchers.activeToday ?? 0}</p>
            <p className="text-[10px] text-primary-foreground/70 mt-0.5">vouchers</p>
          </div>
        </div>
      </div>

      {/* ── KPI strip (5 tiles) ────────────────────────────────────────────── */}
      {isError ? (
        <ErrorState
          variant="inline"
          title="Impossible de charger les indicateurs"
          message="Vérifiez votre connexion au serveur."
          onRetry={onRetry}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          role="list"
          aria-label="Indicateurs clés"
        >
          <div role="listitem">
            <KpiCard
              compact
              title="Revenus aujourd'hui"
              value={formatXof(kpis?.revenue.today ?? 0)}
              icon={<Banknote className="h-3.5 w-3.5" />}
              hint={`${formatXof(kpis?.revenue.thisMonth ?? 0)} ce mois`}
              variant="neutral"
            />
          </div>
          <div role="listitem">
            <KpiCard
              compact
              title="Clients connectés"
              value={liveValue}
              icon={<Activity className="h-3.5 w-3.5" />}
              hint={
                (liveCount ?? 0) > 0
                  ? `${liveResult?.respondingRouters ?? 0}/${liveResult?.totalRouters ?? 0} routeurs`
                  : 'Aucun client'
              }
              variant="success"
              live={(liveCount ?? 0) > 0}
            />
          </div>
          <div role="listitem">
            <KpiCard
              compact
              title="Routeurs en ligne"
              value={`${kpis?.routers.online ?? 0} / ${kpis?.routers.total ?? 0}`}
              icon={<Radio className="h-3.5 w-3.5" />}
              hint={routerOffline > 0 ? `${routerOffline} hors ligne` : 'Tous opérationnels'}
              variant={routerOffline > 0 ? 'warning' : 'success'}
            />
          </div>
          <div role="listitem">
            <KpiCard
              compact
              title="Succès 30j"
              value={`${successRate}%`}
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              hint={
                (kpis?.vouchers.deliveryFailures ?? 0) > 0
                  ? `${kpis!.vouchers.deliveryFailures} échecs livraison`
                  : `${kpis?.vouchers.activeToday ?? 0} vouchers actifs`
              }
              variant={successRate >= 95 ? 'success' : 'warning'}
            />
          </div>
          <div role="listitem" className="col-span-2 sm:col-span-1">
            <KpiCard
              compact
              title="Nouveaux clients / sem."
              value={`+${customerStats?.newThisWeek ?? 0}`}
              icon={<UserPlus className="h-3.5 w-3.5" />}
              hint={`${customerStats?.activeThisWeek ?? 0} actifs cette semaine`}
              variant="neutral"
            />
          </div>
        </div>
      )}
    </header>
  );
}
