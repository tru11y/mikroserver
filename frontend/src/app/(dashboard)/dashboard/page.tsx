'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { IncidentCenterCard } from '@/components/dashboard/incident-center-card';
import { RevenueChart, TopRoutersChart } from '@/components/charts/lazy';
import { RouterStatusPanel } from '@/components/dashboard/router-status-panel';
import { customersApi } from '@/lib/api/customers';
import { apiClient } from '@/lib/api/client';
import { clsx } from 'clsx';
import {
  Banknote,
  Wifi,
  Users,
  CheckCircle2,
  Sparkles,
  UserPlus,
  Activity,
  Radio,
  Ticket,
  AlertTriangle,
  TrendingUp,
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
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m > 0 ? `${m}min` : ''}`.trim();
  if (m > 0) return `${m} min`;
  return '< 1 min';
}

const priorityConfig = {
  HIGH:   { label: 'Haute',   cls: 'bg-red-500/10 text-red-500 border-red-500/20'      },
  MEDIUM: { label: 'Moyenne', cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  LOW:    { label: 'Basse',   cls: 'bg-muted text-muted-foreground border-border'        },
};

// ─── Dense KPI tile (Corporate Slate density) ───────────────────────────────
interface KpiTileProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  live?: boolean;
}

function KpiTile({ label, value, icon, hint, tone = 'default', live }: KpiTileProps) {
  const toneClass = {
    default: 'text-foreground',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    danger: 'text-red-500',
  }[tone];
  const iconBg = {
    default: 'bg-muted text-foreground',
    success: 'bg-emerald-500/10 text-emerald-500',
    warning: 'bg-amber-500/10 text-amber-500',
    danger: 'bg-red-500/10 text-red-500',
  }[tone];

  return (
    <div className="rounded-lg border bg-card p-4 hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <div className={clsx('h-7 w-7 rounded-md flex items-center justify-center shrink-0', iconBg)}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className={clsx('text-2xl font-bold tracking-tight tabular-nums leading-none', toneClass)}>
          {value}
        </p>
        {live && (
          <span className="mb-0.5 flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Live</span>
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-2 text-xs text-muted-foreground truncate">{hint}</p>
      )}
    </div>
  );
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

  const routers = routersData
    ? (routersData.data as { data: { id: string }[] }).data ?? []
    : null;
  const showOnboarding =
    routers !== null &&
    routers.length === 0 &&
    (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN');

  // ─── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded-md" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 h-64 bg-muted rounded-lg" />
          <div className="lg:col-span-2 h-64 bg-muted rounded-lg" />
        </div>
        <div className="h-48 bg-muted rounded-lg" />
      </div>
    );
  }

  const routerOffline = kpis?.routers.offline ?? 0;
  const successRate = kpis?.transactions.successRate ?? 0;

  return (
    <div className="space-y-5">
      {/* ─── Onboarding ────────────────────────────────────────────────────── */}
      {showOnboarding && (
        <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Wifi className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Bienvenue sur MikroServer</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connectez votre premier routeur MikroTik pour commencer.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { step: '1', title: 'Connecter un routeur', desc: 'IP + identifiants',         href: '/routers',           cta: 'Ajouter' },
              { step: '2', title: 'Créer des forfaits',   desc: 'Offres + tarifs',           href: '/plans',             cta: 'Configurer' },
              { step: '3', title: 'Générer des tickets',  desc: 'Premiers vouchers',         href: '/vouchers/generate', cta: 'Démarrer' },
            ].map((item) => (
              <Link key={item.step} href={item.href} className="group rounded-lg bg-card border p-3 hover:border-primary/50 transition-all">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{item.step}</span>
                  <span className="font-semibold text-xs">{item.title}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">{item.desc}</p>
                <span className="text-[11px] font-semibold text-primary group-hover:underline">{item.cta} →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tableau de bord</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Mis à jour toutes les 30 s</p>
        </div>
        <Link
          href="/vouchers/generate"
          className="md:hidden inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Ticket className="h-3.5 w-3.5" />
          Générer
        </Link>
      </div>

      {/* ─── Hero mobile ─────────────────────────────────────────────────────── */}
      <div className="block sm:hidden rounded-lg p-4 relative overflow-hidden bg-primary text-primary-foreground">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/70 mb-1">
          Revenus aujourd&apos;hui
        </p>
        <p className="text-2xl font-bold tracking-tight tabular-nums mb-3">
          {formatXof(kpis?.revenue.today ?? 0)}
        </p>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-base font-bold leading-none tabular-nums">{liveClientsCount ?? 0}</p>
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

      {/* ─── KPI row (5 dense tiles) ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiTile
          label="Revenus aujourd'hui"
          value={formatXof(kpis?.revenue.today ?? 0)}
          icon={<Banknote className="h-3.5 w-3.5" />}
          hint={`${new Intl.NumberFormat('fr-FR').format(kpis?.revenue.thisMonth ?? 0)} F ce mois`}
        />

        <KpiTile
          label="Clients connectés"
          value={isLoadingLiveSessions && liveClientsCount === null ? '…' : String(liveClientsCount ?? 0)}
          icon={<Activity className="h-3.5 w-3.5" />}
          hint={
            (liveClientsCount ?? 0) > 0
              ? `${liveSessionsResult?.respondingRouters ?? 0}/${liveSessionsResult?.totalRouters ?? 0} routeurs`
              : 'Aucun client'
          }
          tone="success"
          live={(liveClientsCount ?? 0) > 0}
        />

        <KpiTile
          label="Routeurs en ligne"
          value={`${kpis?.routers.online ?? 0} / ${kpis?.routers.total ?? 0}`}
          icon={<Radio className="h-3.5 w-3.5" />}
          hint={routerOffline > 0 ? `${routerOffline} hors ligne` : 'Tous opérationnels'}
          tone={routerOffline > 0 ? 'warning' : 'success'}
        />

        <KpiTile
          label="Succès 30j"
          value={`${successRate}%`}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          hint={
            (kpis?.vouchers.deliveryFailures ?? 0) > 0
              ? `${kpis!.vouchers.deliveryFailures} échecs livraison`
              : `${kpis?.vouchers.activeToday ?? 0} vouchers actifs`
          }
          tone={successRate >= 95 ? 'success' : 'warning'}
        />

        <KpiTile
          label="Clients cette semaine"
          value={`+${customerStatsData?.newThisWeek ?? 0}`}
          icon={<UserPlus className="h-3.5 w-3.5" />}
          hint={`${customerStatsData?.activeThisWeek ?? 0} actifs`}
        />
      </div>

      {/* ─── Recommandations ────────────────────────────────────────────────── */}
      {canViewReports && dailyRecommendations.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <h2 className="font-semibold text-sm">Insights automatiques</h2>
            </div>
            <Link href="/analytics" className="text-xs text-primary hover:underline font-medium">
              Tout voir →
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {dailyRecommendations.slice(0, 3).map((rec) => {
              const pCfg = priorityConfig[rec.priority];
              return (
                <Link
                  key={rec.id}
                  href={rec.actionPath || '/analytics'}
                  className="rounded-md border bg-muted/20 p-3 hover:border-primary/40 transition-colors block"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold">{rec.title}</p>
                    <span className={clsx('shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider', pCfg.cls)}>
                      {pCfg.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{rec.summary}</p>
                  <p className="mt-2 text-[11px] font-semibold text-primary">
                    {rec.actionLabel} →
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Revenue chart + Top routeurs ────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RevenueChart />
        </div>
        <div className="lg:col-span-2">
          <div className="rounded-lg border bg-card p-4 h-full">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Top routeurs · 30j</h3>
                <p className="text-[11px] text-muted-foreground">Par revenus générés</p>
              </div>
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {(stats?.topRouters ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <Users className="h-7 w-7 opacity-30" />
                <p className="text-xs">Aucune donnée</p>
              </div>
            ) : (
              <>
                <TopRoutersChart data={stats?.topRouters ?? []} />
                <div className="mt-3 space-y-0.5 border-t pt-2">
                  {(stats?.topRouters ?? []).map((router) => (
                    <Link
                      key={router.id}
                      href={`/routers/${router.id}`}
                      className="flex items-center justify-between py-1.5 text-xs rounded-md px-2 hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-medium truncate max-w-[140px]">{router.name}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-muted-foreground tabular-nums">{router.sessions} sess.</span>
                        <span className="font-semibold tabular-nums">
                          {new Intl.NumberFormat('fr-FR').format(router.revenue)} F
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Routeurs + Incidents ───────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RouterStatusPanel />
        </div>
        <div>
          <IncidentCenterCard />
        </div>
      </div>

      {/* ─── Sessions table ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            {(liveClientsCount ?? 0) > 0 ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
            )}
            <h3 className="font-semibold text-sm">Dernières sessions</h3>
            {(liveClientsCount ?? 0) > 0 && (
              <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Live</span>
            )}
          </div>
          <Link href="/sessions" className="text-xs text-primary hover:underline font-medium">
            Tout voir →
          </Link>
        </div>

        {(stats?.recentSessions ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <Activity className="h-7 w-7 opacity-30" />
            <p className="text-xs">Aucune session active</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {['Utilisateur', 'Adresse MAC', 'Routeur', 'Durée'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(stats?.recentSessions ?? []).map((session) => (
                  <tr key={session.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium">{session.username}</td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">
                      {session.macAddress || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{session.routerName}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                      {formatDuration(session.durationSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Footer status bar ───────────────────────────────────────────────── */}
      {routerOffline > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs flex-1">
            <span className="font-semibold">{routerOffline} routeur{routerOffline > 1 ? 's' : ''} hors ligne.</span>{' '}
            <span className="text-muted-foreground">Vérifiez la connectivité ou l&apos;alimentation.</span>
          </p>
          <Link href="/routers" className="text-xs font-semibold text-amber-500 hover:underline shrink-0">
            Vérifier →
          </Link>
        </div>
      )}
    </div>
  );
}
