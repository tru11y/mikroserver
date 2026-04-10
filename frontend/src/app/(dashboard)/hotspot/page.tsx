'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import {
  AlertTriangle,
  ExternalLink,
  Server,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';

type RouterStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'MAINTENANCE';

type RouterItem = {
  id: string;
  name: string;
  site?: string | null;
  location?: string | null;
  hotspotServer: string;
  hotspotProfile: string;
  status: RouterStatus;
  lastSeenAt?: string | null;
};

function formatRelative(date?: string | null): string {
  if (!date) {
    return 'Jamais';
  }

  return new Date(date).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getStatusConfig(status: RouterStatus) {
  if (status === 'ONLINE') {
    return {
      label: 'En ligne',
      className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
      icon: Wifi,
    };
  }

  if (status === 'DEGRADED') {
    return {
      label: 'Degrade',
      className: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
      icon: AlertTriangle,
    };
  }

  if (status === 'MAINTENANCE') {
    return {
      label: 'Maintenance',
      className: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
      icon: Wrench,
    };
  }

  return {
    label: 'Hors ligne',
    className: 'border-red-400/30 bg-red-400/10 text-red-300',
    icon: WifiOff,
  };
}

export default function HotspotOpsPage() {
  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['hotspot-me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canViewRouters = hasPermission(currentUser, 'routers.view');

  const { data: routersData, isLoading: routersLoading } = useQuery({
    queryKey: ['hotspot-routers'],
    queryFn: () => api.routers.list(),
    enabled: canViewRouters,
    refetchInterval: 30_000,
  });

  const routers = useMemo<RouterItem[]>(
    () => (routersData ? unwrap<RouterItem[]>(routersData) : []),
    [routersData],
  );

  const summary = useMemo(() => {
    const online = routers.filter((router) => router.status === 'ONLINE').length;
    const degraded = routers.filter((router) => router.status === 'DEGRADED').length;
    const maintenance = routers.filter((router) => router.status === 'MAINTENANCE').length;
    return {
      total: routers.length,
      online,
      degraded,
      maintenance,
    };
  }, [routers]);

  if (isMeLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!canViewRouters) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <Server className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Acces limite</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ton profil ne permet pas de consulter les operations hotspot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Hotspot Ops</h1>
        <p className="text-sm text-muted-foreground">
          Console operationnelle hotspot. Pour editer IP bindings, profils et utilisateurs, ouvre un routeur.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Routeurs hotspot</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{summary.total}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">En ligne</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-300">{summary.online}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Degrades</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-amber-300">{summary.degraded}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Maintenance</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-blue-300">{summary.maintenance}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Controle IA des forfaits</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Analyse anti-depassement visible dans chaque fiche routeur, section
              "Utilisateurs hotspot (actifs et inactifs)".
            </p>
          </div>
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Routeurs et hotspots</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ouvre la fiche routeur pour gerer profils hotspot, utilisateurs et IP bindings.
          </p>
        </div>

        {routersLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Chargement des routeurs...</div>
        ) : routers.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">Aucun routeur disponible.</div>
        ) : (
          <div className="divide-y">
            {routers.map((router) => {
              const status = getStatusConfig(router.status);
              const StatusIcon = status.icon;

              return (
                <div key={router.id} className="p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold">{router.name}</p>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${status.className}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                        {router.site && (
                          <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                            {router.site}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Hotspot: <span className="font-medium">{router.hotspotServer || '-'}</span> | Profil par defaut:{' '}
                        <span className="font-medium">{router.hotspotProfile || '-'}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Localisation: {router.location || '-'} | Derniere activite: {formatRelative(router.lastSeenAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/routers/${router.id}`}
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Gerer hotspot
                      </Link>
                      <Link
                        href={`/portal?hotspot=${encodeURIComponent(router.hotspotServer || 'hotspot1')}&site=${encodeURIComponent(router.name)}`}
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Voir portail
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
