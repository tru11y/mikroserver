'use client';

import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Plus,
  RefreshCw,
  Server,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';

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
}

export function RoutersHeroSection({
  summary,
  canManageRouters,
  isRefreshing,
  onRefresh,
  onCreate,
}: RoutersHeroSectionProps) {
  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border bg-[linear-gradient(135deg,rgba(56,189,248,0.12),rgba(59,130,246,0.08),rgba(15,23,42,0.02))] p-6 shadow-[0_22px_70px_-50px_rgba(14,165,233,0.55)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
              <Server className="h-3.5 w-3.5" />
              Pilotage reseau multi-sites
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Flotte de routeurs</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Une vue d&apos;exploitation plus claire, plus commerciale et plus rassurante
              pour suivre l&apos;etat du parc, les sites et les operations sensibles.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="#fleet-filters"
              className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              Filtres
            </a>
            <a
              href="#fleet"
              className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              Flotte
            </a>
            {canManageRouters ? (
              <a
                href="#composer"
                onClick={onCreate}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Ajouter un routeur
              </a>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors hover:bg-muted/40"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          title="Total"
          value={String(summary.total)}
          icon={<Server className="h-4 w-4" />}
          variant="primary"
        />
        <KpiCard
          title="En ligne"
          value={String(summary.online)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          variant="success"
        />
        <KpiCard
          title="Degrades"
          value={String(summary.degraded)}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant="warning"
        />
        <KpiCard
          title="Hors ligne"
          value={String(summary.offline)}
          icon={<WifiOff className="h-4 w-4" />}
          variant="danger"
        />
        <KpiCard
          title="Maintenance"
          value={String(summary.maintenance)}
          icon={<Wrench className="h-4 w-4" />}
          variant="warning"
        />
        <KpiCard
          title="Sites"
          value={String(summary.sites)}
          icon={<MapPin className="h-4 w-4" />}
          variant="primary"
        />
      </div>
    </section>
  );
}
