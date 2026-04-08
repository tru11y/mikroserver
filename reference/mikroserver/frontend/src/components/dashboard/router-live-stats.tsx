'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Users, ArrowDown, ArrowUp } from 'lucide-react';

interface RouterLiveStats {
  routerId: string;
  activeClients: number;
  totalBytesIn: number;
  totalBytesOut: number;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  fetchedAt: string;
}

interface RouterLiveStatsProps {
  routerId: string;
}

function formatBandwidth(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function RouterLiveStatsComponent({ routerId }: RouterLiveStatsProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['routers', routerId, 'live-stats'],
    queryFn: () => api.routers.liveStats(routerId),
    refetchInterval: 15_000, // Refresh every 15s
    retry: 1, // Don't retry too many times if router is unreachable
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 mt-2 h-5">
         <div className="h-2 w-16 bg-muted animate-pulse rounded" />
         <div className="h-2 w-16 bg-muted animate-pulse rounded" />
         <div className="h-2 w-16 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (isError || !data?.data?.data) {
    return (
      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <span>Statistiques indisponibles</span>
      </div>
    );
  }

  const stats = data.data.data as RouterLiveStats;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs font-medium text-muted-foreground">
      <div className="flex items-center gap-1.5" title="Utilisateurs connectés">
        <Users className="h-3.5 w-3.5" />
        <span>{stats.activeClients} client{stats.activeClients > 1 ? 's' : ''}</span>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="Téléchargement (Download)">
          <ArrowDown className="h-3.5 w-3.5" />
          <span>{formatBandwidth(stats.txBytesPerSec)}</span>
        </div>
        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400" title="Envoi (Upload)">
          <ArrowUp className="h-3.5 w-3.5" />
          <span>{formatBandwidth(stats.rxBytesPerSec)}</span>
        </div>
      </div>
    </div>
  );
}
