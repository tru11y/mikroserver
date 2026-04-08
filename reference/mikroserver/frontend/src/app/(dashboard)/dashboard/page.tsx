'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { RouterStatusPanel } from '@/components/dashboard/router-status-panel';
import { TransactionFeed } from '@/components/dashboard/transaction-feed';
import {
  Banknote,
  TrendingUp,
  Wifi,
  Users,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface DashboardKpis {
  revenue: { today: number; thisMonth: number; last30Days: number; total: number };
  transactions: { today: number; thisMonth: number; successRate: number; pending: number };
  vouchers: { activeToday: number; deliveryFailures: number };
  routers: { online: number; offline: number; total: number };
  customers: { uniqueToday: number; uniqueThisMonth: number };
}

function formatXof(amount: number): string {
  return new Intl.NumberFormat('fr-CI', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardPage() {
  const { data: kpisResponse, isLoading } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.metrics.dashboard(),
    refetchInterval: 30_000, // Auto-refresh every 30s
  });

  const kpis = kpisResponse?.data?.data as DashboardKpis | undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vue d'ensemble · Mis à jour en temps réel
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Revenus aujourd'hui"
          value={formatXof(kpis?.revenue.today ?? 0)}
          icon={<Banknote className="h-4 w-4" />}
          trend={{ value: kpis?.transactions.today ?? 0, label: 'transactions' }}
          variant="primary"
        />
        <KpiCard
          title="Revenus ce mois"
          value={formatXof(kpis?.revenue.thisMonth ?? 0)}
          icon={<TrendingUp className="h-4 w-4" />}
          trend={{ value: kpis?.customers.uniqueThisMonth ?? 0, label: 'clients uniques' }}
          variant="success"
        />
        <KpiCard
          title="Routeurs en ligne"
          value={`${kpis?.routers.online ?? 0} / ${kpis?.routers.total ?? 0}`}
          icon={<Wifi className="h-4 w-4" />}
          trend={
            kpis?.routers.offline
              ? { value: kpis.routers.offline, label: 'hors ligne', alert: true }
              : undefined
          }
          variant={kpis?.routers.offline ? 'warning' : 'success'}
        />
        <KpiCard
          title="Taux de succès (30j)"
          value={`${kpis?.transactions.successRate ?? 0}%`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          trend={
            kpis?.vouchers.deliveryFailures
              ? { value: kpis.vouchers.deliveryFailures, label: 'échecs livraison', alert: true }
              : undefined
          }
          variant={
            (kpis?.transactions.successRate ?? 0) >= 95 ? 'success' : 'warning'
          }
        />
      </div>

      {/* Charts + Status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <RouterStatusPanel />
      </div>

      {/* Transaction Feed */}
      <TransactionFeed />
    </div>
  );
}
