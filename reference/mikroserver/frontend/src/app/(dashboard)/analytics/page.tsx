'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarChart3, TrendingUp, Users, CreditCard, Wifi } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function AnalyticsPage() {
  const { data: dashData } = useQuery({
    queryKey: ['metrics-dashboard'],
    queryFn: () => api.metrics.dashboard(),
  });

  const { data: chartData } = useQuery({
    queryKey: ['revenue-chart'],
    queryFn: () => api.metrics.revenueChart(30),
  });

  const metrics = (dashData as any)?.data?.data ?? {};
  const revenuePoints = (chartData as any)?.data?.data ?? [];

  const formattedPoints = revenuePoints.map((p: any) => ({
    date: new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    revenus: p.revenueXof ?? 0,
    transactions: p.transactions ?? 0,
  }));

  const stats = [
    { label: 'Revenus ce mois', value: `${(metrics.revenue?.thisMonth ?? 0).toLocaleString('fr-FR')} FCFA`, icon: CreditCard, color: 'text-primary' },
    { label: 'Transactions (30j)', value: metrics.transactions?.thisMonth ?? 0, icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'Clients uniques', value: metrics.customers?.uniqueThisMonth ?? 0, icon: Users, color: 'text-blue-400' },
    { label: 'Routeurs en ligne', value: `${metrics.routers?.online ?? 0} / ${metrics.routers?.total ?? 0}`, icon: Wifi, color: 'text-violet-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytique</h1>
        <p className="text-muted-foreground text-sm mt-1">Vue d'ensemble des 30 derniers jours</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-card p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                <div className={`p-1.5 rounded-lg bg-muted ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold mb-1">Revenus journaliers — FCFA</h2>
        <p className="text-xs text-muted-foreground mb-5">30 derniers jours</p>
        {formattedPoints.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune donnée disponible</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={formattedPoints}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number) => [`${v.toLocaleString('fr-FR')} FCFA`, 'Revenus']}
              />
              <Area type="monotone" dataKey="revenus" stroke="hsl(var(--primary))" fill="url(#colorRevenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold mb-1">Transactions par jour</h2>
        <p className="text-xs text-muted-foreground mb-5">Nombre de paiements Wave</p>
        {formattedPoints.length === 0 ? (
          <div className="h-32 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Aucune donnée disponible</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={formattedPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number) => [v, 'Transactions']}
              />
              <Bar dataKey="transactions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
