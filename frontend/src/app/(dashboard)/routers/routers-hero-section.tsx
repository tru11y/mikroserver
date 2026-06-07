'use client';

import { CheckCircle2, MapPin, Plus, RefreshCw, Server, AlertTriangle, WifiOff, Wrench } from 'lucide-react';
import { clsx } from 'clsx';
import type { RouterStatus } from './routers.types';

const SECTION_ID = 'routers-hero-heading';

function getProgressWidthClass(rate: number): string {
  if (rate >= 100) return 'w-full';
  if (rate >= 90)  return 'w-11/12';
  if (rate >= 83)  return 'w-10/12';
  if (rate >= 75)  return 'w-9/12';
  if (rate >= 67)  return 'w-8/12';
  if (rate >= 58)  return 'w-7/12';
  if (rate >= 50)  return 'w-6/12';
  if (rate >= 42)  return 'w-5/12';
  if (rate >= 33)  return 'w-4/12';
  if (rate >= 25)  return 'w-3/12';
  if (rate >= 17)  return 'w-2/12';
  return 'w-1/12';
}

interface RoutersHeroSectionProps {
  summary: {
    total: number;
    online: number;
    degraded: number;
    offline: number;
    maintenance: number;
    sites: number;
  };
  canManageRouters: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  onFilterByStatus: (status: RouterStatus | 'ALL') => void;
}

interface MiniStat {
  label: string;
  value: number;
  icon: typeof Server;
  tileClass: string;
  valueClass: string;
}

const STATS = (s: RoutersHeroSectionProps['summary']): MiniStat[] => [
  { label: 'Total',       value: s.total,       icon: Server,        tileClass: 'bg-muted text-foreground',             valueClass: ''                 },
  { label: 'En ligne',    value: s.online,      icon: CheckCircle2,  tileClass: 'bg-success/10 text-success',           valueClass: 'text-success'     },
  { label: 'Dégradés',    value: s.degraded,    icon: AlertTriangle, tileClass: 'bg-warning/10 text-warning',           valueClass: 'text-warning'     },
  { label: 'Hors ligne',  value: s.offline,     icon: WifiOff,       tileClass: 'bg-destructive/10 text-destructive',   valueClass: 'text-destructive' },
  { label: 'Maintenance', value: s.maintenance, icon: Wrench,        tileClass: 'bg-warning/10 text-warning',           valueClass: 'text-warning'     },
  { label: 'Sites',       value: s.sites,       icon: MapPin,        tileClass: 'bg-primary/10 text-primary',           valueClass: ''                 },
];

export function RoutersHeroSection({
  summary,
  canManageRouters,
  isRefreshing,
  onRefresh,
  onCreate,
  onFilterByStatus,
}: RoutersHeroSectionProps) {
  const stats = STATS(summary);
  const onlineRate = summary.total > 0 ? Math.round((summary.online / summary.total) * 100) : 100;
  const hasCritical = summary.offline > 0 || summary.degraded > 0;

  return (
    <section aria-labelledby={SECTION_ID} className="space-y-3">
      {/* Title + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id={SECTION_ID} className="text-lg font-semibold tracking-tight">
            Routeurs
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {summary.total} routeur{summary.total !== 1 ? 's' : ''} · {summary.sites} site{summary.sites !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Actualiser la flotte"
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/50 active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <RefreshCw className={clsx('h-3.5 w-3.5', isRefreshing && 'animate-spin')} aria-hidden="true" />
            Actualiser
          </button>
          {canManageRouters && (
            <button
              type="button"
              onClick={onCreate}
              aria-label="Ajouter un routeur"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 hover:shadow-[var(--shadow-glow)] active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Alert banner — visible only when fleet has issues */}
      {hasCritical && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
        >
          <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider">
            Alertes
          </span>
          {summary.offline > 0 && (
            <button
              type="button"
              onClick={() => onFilterByStatus('OFFLINE')}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive hover:bg-destructive/20 active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`Filtrer les ${summary.offline} routeurs hors ligne`}
            >
              <WifiOff className="h-3 w-3" aria-hidden="true" />
              {summary.offline} hors ligne
            </button>
          )}
          {summary.degraded > 0 && (
            <button
              type="button"
              onClick={() => onFilterByStatus('DEGRADED')}
              className="inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning hover:bg-warning/20 active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`Filtrer les ${summary.degraded} routeurs dégradés`}
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {summary.degraded} dégradé{summary.degraded > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5">
        {stats.map(({ label, value, icon: Icon, tileClass, valueClass }) => (
          <div
            key={label}
            className="rounded-lg border bg-card p-3 hover:border-primary/30 hover:shadow-[var(--shadow-md)] transition-all duration-200 ease-out"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
                {label}
              </p>
              <div className={clsx('h-6 w-6 rounded-md flex items-center justify-center shrink-0', tileClass)}>
                <Icon className="h-3 w-3" aria-hidden="true" />
              </div>
            </div>
            <p className={clsx('text-xl font-bold tracking-tight tabular-nums leading-none', valueClass)}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Fleet availability progress bar */}
      {summary.total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Disponibilité flotte</span>
            <span className="tabular-nums font-medium">
              {summary.online}/{summary.total} · {onlineRate}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`Disponibilité : ${onlineRate}% — ${summary.online} sur ${summary.total} routeurs en ligne`}
            className="h-1.5 rounded-full bg-muted overflow-hidden"
          >
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                getProgressWidthClass(onlineRate),
                onlineRate >= 80 ? 'bg-success' : onlineRate >= 50 ? 'bg-warning' : 'bg-destructive',
              )}
            />
          </div>
        </div>
      )}
    </section>
  );
}
