'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { Wifi, WifiOff, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { RouterLiveStatsComponent } from './router-live-stats';

interface Router {
  id: string;
  name: string;
  location: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'MAINTENANCE';
  lastSeenAt: string | null;
  wireguardIp: string;
}

const statusConfig = {
  ONLINE: {
    label: 'En ligne',
    dot: 'bg-emerald-500',
    icon: Wifi,
    iconClass: 'text-emerald-500',
  },
  OFFLINE: {
    label: 'Hors ligne',
    dot: 'bg-red-500',
    icon: WifiOff,
    iconClass: 'text-red-500',
  },
  DEGRADED: {
    label: 'Dégradé',
    dot: 'bg-amber-500',
    icon: Wifi,
    iconClass: 'text-amber-500',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    dot: 'bg-blue-500',
    icon: Clock,
    iconClass: 'text-blue-500',
  },
};

export function RouterStatusPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['routers', 'list'],
    queryFn: () => api.routers.list(),
    refetchInterval: 60_000,
  });

  const routers = (data?.data?.data as Router[]) ?? [];

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4">
        <h3 className="font-semibold">Routeurs</h3>
        <p className="text-sm text-muted-foreground">Statut en temps réel</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : routers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Aucun routeur configuré
        </div>
      ) : (
        <div className="space-y-2">
          {routers.map((router) => {
            const config = statusConfig[router.status] ?? statusConfig.OFFLINE;
            const StatusIcon = config.icon;

            return (
              <div
                key={router.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
              >
                <div className="relative">
                  <StatusIcon className={clsx('h-4 w-4', config.iconClass)} />
                  <span
                    className={clsx(
                      'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full',
                      config.dot,
                      router.status === 'ONLINE' && 'animate-pulse',
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{router.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {router.location ?? router.wireguardIp}
                  </p>
                  {router.status === 'ONLINE' && (
                    <RouterLiveStatsComponent routerId={router.id} />
                  )}
                </div>
                <div className="text-right">
                  <p
                    className={clsx(
                      'text-xs font-medium',
                      config.iconClass,
                    )}
                  >
                    {config.label}
                  </p>
                  {router.lastSeenAt && (
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(router.lastSeenAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
