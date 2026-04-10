'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { IncidentCenterCard } from '@/components/dashboard/incident-center-card';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { RouterStatusPanel } from '@/components/dashboard/router-status-panel';
import { TransactionFeed } from '@/components/dashboard/transaction-feed';
import { customersApi } from '@/lib/api/customers';
import { apiClient } from '@/lib/api/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Banknote,
  TrendingUp,
  Wifi,
  Users,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  UserPlus,
  Crown,
  Activity,
  Radio,
} from 'lucide-react';

interface DashboardKpis {
  revenue: { today: number; thisMonth: number; last30Days: number; total: number };
  transactions: { today: number; thisMonth: number; successRate: number; pending: number };
  vouchers: { activeToday: number; deliveryFailures: number };
  routers: { online: number; offline: number; total: number };
  customers: { uniqueToday: number; uniqueThisMonth: number };
}

interface DashboardStats {
  activeSessions: number;
  revenueToday: number;
  revenueThisMonth: number;
  newCustomersToday: number;
  totalVouchersGenerated: number;
  totalVouchersUsed: number;
  routersOnline: number;
  routersTotal: number;
  topRouters: Array<{ id: string; name: string; revenue: number; sessions: number }>;
  recentSessions: Array<{
    id: string;
    username: string;
    macAddress: string;
    routerName: string;
    createdAt: string;
    durationSeconds: number;
  }>;
}

interface SessionsResponse {
  items: unknown[];
  routerErrors: unknown[];
  totalRouters: number;
  respondingRouters: number;
}

interface CustomerStats {
  total: number;
  newThisWeek: number;
  activeThisWeek: number;
}

interface SaasSubscription {
  tier?: { name?: string };
  expiresAt?: string | null;
  status?: string;
}

interface DailyRecommendation {
  id: string;
  title: string;
  summary: string;
  actionLabel: string;
  actionPath: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

function formatXof(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `Il y a ${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
}

export default function DashboardPage() {
  const { data: meData } = useQuery({
    queryKey: ['dashboard', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canViewReports = hasPermission(currentUser, 'reports.view');

  const { data: kpisResponse, isLoading } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.metrics.dashboard(),
    refetchInterval: 30_000,
  });

  const { data: dashboardStatsResponse } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.metrics.dashboardStats(),
    refetchInterval: 30_000,
  });

  const { data: dailyRecommendationsData } = useQuery({
    queryKey: ['dashboard', 'daily-recommendations'],
    queryFn: () => api.metrics.dailyRecommendations(),
    enabled: canViewReports,
    staleTime: 60_000,
  });

  const { data: customerStatsData } = useQuery({
    queryKey: ['dashboard', 'customer-stats'],
    queryFn: async () => {
      const res = await customersApi.getStats();
      return (res.data as unknown as { data: CustomerStats }).data;
    },
    staleTime: 60_000,
  });

  const { data: subscriptionData } = useQuery({
    queryKey: ['dashboard', 'subscription'],
    queryFn: async () => {
      const res = await apiClient.get('/saas/subscription');
      return (res.data as unknown as { data: SaasSubscription }).data;
    },
    staleTime: 5 * 60_000,
  });

  const { data: liveSessionsData, isLoading: isLoadingLiveSessions } = useQuery({
    queryKey: ['dashboard', 'live-sessions'],
    queryFn: () => api.sessions.active(),
    refetchInterval: 10_000,
    staleTime: 0,
  });

  const { data: routersData } = useQuery({
    queryKey: ['routers-count'],
    queryFn: () => apiClient.get('/routers'),
    staleTime: 60_000,
  });

  const kpis = kpisResponse?.data?.data as DashboardKpis | undefined;
  const stats = dashboardStatsResponse?.data?.data as DashboardStats | undefined;
  const liveSessionsResult = liveSessionsData?.data?.data as SessionsResponse | undefined;
  const liveClientsCount = liveSessionsResult?.items?.length ?? null;
  const dailyRecommendations: DailyRecommendation[] = dailyRecommendationsData
    ? (unwrap<{ items: DailyRecommendation[] }>(dailyRecommendationsData).items ?? [])
    : [];

  const routers = routersData ? (routersData.data as any)?.data ?? [] : null;
  const showOnboarding =
    routers !== null &&
    routers.length === 0 &&
    (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN');

  const subscriptionDaysRemaining = subscriptionData?.expiresAt
    ? Math.max(0, Math.ceil((new Date(subscriptionData.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showOnboarding && (
        <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Wifi className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Bienvenue sur MikroServer !</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Votre plateforme est prête. Commencez par connecter votre premier routeur MikroTik.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { step: '1', title: 'Connecter un routeur', desc: 'Ajoutez votre MikroTik avec son IP et ses identifiants', href: '/routers', cta: 'Ajouter un routeur' },
              { step: '2', title: 'Créer des forfaits', desc: 'Définissez vos offres WiFi et tarifs', href: '/plans', cta: 'Gérer les forfaits' },
              { step: '3', title: 'Générer des tickets', desc: 'Distribuez vos premiers tickets hotspot', href: '/vouchers/generate', cta: 'Générer des tickets' },
            ].map(item => (
              <Link key={item.step} href={item.href} className="group rounded-xl bg-card border p-4 hover:border-primary/50 hover:shadow-sm transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{item.step}</span>
                  <span className="font-semibold text-sm">{item.title}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{item.desc}</p>
                <span className="text-xs font-medium text-primary group-hover:underline">{item.cta} →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vue d&apos;ensemble · Mis à jour en temps réel
        </p>
      </div>

      {/* Live status row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Active sessions — RouterOS live count */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-muted-foreground">Clients connectés</p>
            <div className="flex items-center gap-1.5">
              {(liveClientsCount ?? 0) > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              )}
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          {isLoadingLiveSessions && liveClientsCount === null ? (
            <div className="h-9 mt-1 flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            </div>
          ) : (
            <p className="text-3xl font-bold mt-1">{liveClientsCount ?? 0}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {(liveClientsCount ?? 0) > 0
              ? `${liveSessionsResult?.respondingRouters ?? 0}/${liveSessionsResult?.totalRouters ?? 0} routeurs répondent`
              : 'Aucun client connecté'}
          </p>
        </div>

        {/* Transactions pending */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-muted-foreground">Transactions en attente</p>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold mt-1">{kpis?.transactions.pending ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(kpis?.transactions.pending ?? 0) > 0 ? 'En cours de traitement' : 'File d\'attente vide'}
          </p>
        </div>

        {/* Routers online */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-muted-foreground">Routeurs en ligne</p>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold mt-1">
            {kpis?.routers.online ?? 0}
            <span className="text-lg font-normal text-muted-foreground">
              /{kpis?.routers.total ?? 0}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {(kpis?.routers.offline ?? 0) > 0
              ? `${kpis?.routers.offline} hors ligne`
              : 'Tous opérationnels'}
          </p>
        </div>
      </div>

      {/* Original KPI Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
        <KpiCard
          title="Clients cette semaine"
          value={`+${customerStatsData?.newThisWeek ?? 0}`}
          icon={<UserPlus className="h-4 w-4" />}
          trend={{ value: customerStatsData?.activeThisWeek ?? 0, label: 'actifs' }}
          variant="primary"
        />
        <KpiCard
          title="Abonnement"
          value={subscriptionData?.tier?.name ?? '—'}
          icon={<Crown className="h-4 w-4" />}
          trend={
            subscriptionDaysRemaining !== null
              ? {
                  value: subscriptionDaysRemaining,
                  label: 'jours restants',
                  alert: subscriptionDaysRemaining <= 7,
                }
              : undefined
          }
          variant={
            subscriptionDaysRemaining !== null && subscriptionDaysRemaining <= 7
              ? 'warning'
              : 'success'
          }
        />
      </div>

      {canViewReports && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Recommandations IA</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Suggestions automatiques basees sur incidents et ventes.
              </p>
            </div>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>

          {dailyRecommendations.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucune recommandation disponible pour le moment.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {dailyRecommendations.slice(0, 3).map((recommendation) => (
                <div key={recommendation.id} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{recommendation.title}</p>
                    <span className="text-[11px] text-muted-foreground">
                      {recommendation.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{recommendation.summary}</p>
                  <Link
                    href={recommendation.actionPath || '/analytics'}
                    className="mt-2 inline-flex items-center rounded-md border px-2.5 py-1 text-xs hover:bg-muted/50"
                  >
                    {recommendation.actionLabel}
                  </Link>
                </div>
              ))}
              <Link
                href="/analytics"
                className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs hover:bg-muted/50"
              >
                Voir toutes les recommandations
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Revenue chart + Top routers */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RevenueChart />
        </div>
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card p-5 h-full">
            <h3 className="font-semibold mb-1">Top routeurs ce mois</h3>
            <p className="text-xs text-muted-foreground mb-4">Par revenus générés</p>
            {(stats?.topRouters ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={stats?.topRouters ?? []}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      new Intl.NumberFormat('fr-FR').format(value) + ' FCFA',
                      'Revenus',
                    ]}
                    contentStyle={{
                      fontSize: 12,
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      background: 'hsl(var(--card))',
                    }}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Table fallback for top routers */}
            {(stats?.topRouters ?? []).length > 0 && (
              <div className="mt-4 space-y-1">
                {(stats?.topRouters ?? []).map((router) => (
                  <div
                    key={router.id}
                    className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0"
                  >
                    <span className="font-medium truncate max-w-[140px]">{router.name}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{router.sessions} sess.</span>
                      <span className="font-semibold text-foreground">
                        {new Intl.NumberFormat('fr-FR').format(router.revenue)} FCFA
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts + Status (original) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <RouterStatusPanel />
        </div>
        <div>
          <IncidentCenterCard />
        </div>
      </div>

      {/* Live sessions table */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 p-5 border-b">
          <span className="relative flex h-2.5 w-2.5">
            {(liveClientsCount ?? 0) > 0 ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-muted-foreground/40" />
            )}
          </span>
          <h3 className="font-semibold">Dernières sessions (DB)</h3>
          <span className="ml-auto text-xs text-muted-foreground">
            Rafraîchissement auto toutes les 30s
          </span>
        </div>

        {(stats?.recentSessions ?? []).length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucune session active pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Utilisateur
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    MAC
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Routeur
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Connecté depuis
                  </th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recentSessions ?? []).map((session) => (
                  <tr
                    key={session.id}
                    className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">{session.username}</td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">
                      {session.macAddress || '—'}
                    </td>
                    <td className="px-4 py-2.5">{session.routerName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {formatDuration(session.durationSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Feed */}
      <TransactionFeed />
    </div>
  );
}
