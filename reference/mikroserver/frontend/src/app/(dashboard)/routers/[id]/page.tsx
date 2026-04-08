'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Wifi, WifiOff, ArrowLeft, Activity, Users, Download,
  Upload, MapPin, Server, RefreshCw, Clock, Radio,
  ChevronUp, ChevronDown, Ban,
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RouterDetail {
  id: string; name: string; location?: string; wireguardIp: string;
  apiPort: number; apiUsername: string; hotspotProfile: string;
  hotspotServer: string; status: string; lastSeenAt?: string;
}

interface LiveClient {
  id: string; username: string; ipAddress: string;
  macAddress: string; uptime: string; bytesIn: number; bytesOut: number;
}

interface LiveStats {
  routerId: string; activeClients: number; totalBytesIn: number;
  totalBytesOut: number; rxBytesPerSec: number; txBytesPerSec: number;
  clients: LiveClient[]; fetchedAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatBps(bps: number): string {
  if (bps === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  return `${parseFloat((bps / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function BandwidthBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function RouterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [maxBps, setMaxBps] = useState(1);
  const [sortCol, setSortCol] = useState<'username' | 'bytesIn' | 'bytesOut' | 'uptime'>('bytesIn');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Router info
  const { data: routerData } = useQuery({
    queryKey: ['router', id],
    queryFn: () => api.routers.get(id),
    refetchInterval: 15_000,
  });
  const routerInfo: RouterDetail | undefined = (routerData as any)?.data?.data;

  // Live stats — polling every 5s
  const { data: statsData, isLoading: statsLoading, dataUpdatedAt } = useQuery({
    queryKey: ['router-live', id],
    queryFn: () => api.routers.liveStats(id),
    refetchInterval: 5_000,
    retry: false,
  });
  const stats: LiveStats | undefined = (statsData as any)?.data?.data;

  // Update max for bandwidth bar
  useEffect(() => {
    if (stats) {
      const peak = Math.max(stats.rxBytesPerSec, stats.txBytesPerSec, 1);
      setMaxBps(prev => Math.max(prev, peak));
    }
  }, [stats]);

  const healthCheck = async () => {
    setIsChecking(true);
    try {
      await api.routers.healthCheck(id);
      await queryClient.invalidateQueries({ queryKey: ['router', id] });
    } finally {
      setIsChecking(false);
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: (mikrotikId: string) => api.sessions.terminate(id, mikrotikId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['router-live', id] });
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onSettled: () => setDisconnectingId(null),
  });

  const sortedClients = [...(stats?.clients ?? [])].sort((a, b) => {
    const mul = sortDir === 'desc' ? -1 : 1;
    if (sortCol === 'username') return mul * a.username.localeCompare(b.username);
    if (sortCol === 'uptime') return mul * a.uptime.localeCompare(b.uptime);
    return mul * ((a[sortCol] as number) - (b[sortCol] as number));
  });

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const isOnline = routerInfo?.status === 'ONLINE';
  const statusCfg = isOnline
    ? { label: 'En ligne', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' }
    : { label: 'Hors ligne', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', dot: 'bg-red-400' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push('/routers')}
          className="p-2 rounded-lg border hover:bg-muted transition-colors mt-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {routerInfo?.name ?? '...'}
            </h1>
            {routerInfo && (
              <span className={clsx('flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium', statusCfg.bg, statusCfg.color)}>
                <span className={clsx('h-1.5 w-1.5 rounded-full', statusCfg.dot, isOnline && 'animate-pulse')} />
                {statusCfg.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {routerInfo?.location && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{routerInfo.location}</span>
            )}
            <span className="flex items-center gap-1"><Server className="h-3 w-3" />{routerInfo?.wireguardIp}:{routerInfo?.apiPort}</span>
            {routerInfo?.lastSeenAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Vu {formatDistanceToNow(new Date(routerInfo.lastSeenAt), { addSuffix: true, locale: fr })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Radio className="h-3 w-3 text-emerald-400" />
              Live · {new Date(dataUpdatedAt).toLocaleTimeString('fr-FR')}
            </span>
          )}
          <button
            onClick={healthCheck}
            disabled={isChecking}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Activity className={clsx('h-4 w-4', isChecking && 'animate-spin')} />
            {isChecking ? 'Test...' : 'Health check'}
          </button>
        </div>
      </div>

      {/* Live KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active clients */}
        <div className="rounded-xl border bg-card p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Clients actifs</span>
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-4xl font-bold tabular-nums">
              {statsLoading ? <span className="animate-pulse text-muted-foreground">—</span> : (stats?.activeClients ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">sur {routerInfo?.hotspotServer ?? 'hotspot'}</p>
          </div>
        </div>

        {/* Download speed */}
        <div className="rounded-xl border bg-card p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Download</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <Download className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-400">
              {statsLoading ? '—' : formatBps(stats?.rxBytesPerSec ?? 0)}
            </p>
            <div className="mt-2">
              <BandwidthBar value={stats?.rxBytesPerSec ?? 0} max={maxBps} color="bg-emerald-400" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total: {formatBytes(stats?.totalBytesIn ?? 0)}</p>
          </div>
        </div>

        {/* Upload speed */}
        <div className="rounded-xl border bg-card p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Upload</span>
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <Upload className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums text-blue-400">
              {statsLoading ? '—' : formatBps(stats?.txBytesPerSec ?? 0)}
            </p>
            <div className="mt-2">
              <BandwidthBar value={stats?.txBytesPerSec ?? 0} max={maxBps} color="bg-blue-400" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total: {formatBytes(stats?.totalBytesOut ?? 0)}</p>
          </div>
        </div>

        {/* Hotspot info */}
        <div className="rounded-xl border bg-card p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hotspot</span>
              <div className="p-1.5 rounded-lg bg-violet-500/10">
                <Wifi className="h-4 w-4 text-violet-400" />
              </div>
            </div>
            <p className="text-lg font-bold">{routerInfo?.hotspotServer ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Profil: {routerInfo?.hotspotProfile ?? '—'}</p>
            <p className="text-xs text-muted-foreground">API: {routerInfo?.apiUsername}</p>
          </div>
        </div>
      </div>

      {/* Clients table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Clients connectés</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Mise à jour toutes les 5 secondes</p>
          </div>
          {statsLoading && (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {!stats || stats.clients.length === 0 ? (
          <div className="py-12 text-center">
            <WifiOff className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {statsLoading ? 'Chargement...' : (stats ? 'Aucun client connecté' : 'Routeur hors ligne ou inaccessible')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {[
                    { col: 'username' as const, label: 'Utilisateur' },
                    { col: null, label: 'IP / MAC' },
                    { col: 'uptime' as const, label: 'Durée' },
                    { col: 'bytesIn' as const, label: 'Download' },
                    { col: 'bytesOut' as const, label: 'Upload' },
                    { col: null, label: '' },
                  ].map(({ col, label }) => (
                    <th
                      key={label}
                      onClick={() => col && toggleSort(col)}
                      className={clsx(
                        'text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider',
                        col && 'cursor-pointer hover:text-foreground select-none',
                      )}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {col && sortCol === col && (
                          sortDir === 'desc'
                            ? <ChevronDown className="h-3 w-3" />
                            : <ChevronUp className="h-3 w-3" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedClients.map((client) => (
                  <tr key={client.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                        <span className="font-medium font-mono text-xs">{client.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs">{client.ipAddress}</p>
                      <p className="font-mono text-xs text-muted-foreground">{client.macAddress}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs">{client.uptime}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-emerald-400 font-medium">{formatBytes(client.bytesIn)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-blue-400 font-medium">{formatBytes(client.bytesOut)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => { setDisconnectingId(client.id); disconnectMutation.mutate(client.id); }}
                        disabled={disconnectMutation.isPending}
                        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50"
                      >
                        <Ban className="h-3 w-3" />
                        {disconnectingId === client.id ? 'Coupure...' : 'Couper'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
