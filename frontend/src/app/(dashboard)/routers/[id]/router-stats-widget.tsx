'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, Upload, Users } from 'lucide-react';
import { api, unwrap, apiError } from '@/lib/api';

interface RouterBandwidthStats {
  totalTxBytes: number;
  totalRxBytes: number;
  activeConnections: number;
  interfaces: Array<{
    name: string;
    txBytes: number;
    rxBytes: number;
    running: boolean;
  }>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface RouterStatsWidgetProps {
  routerId: string;
}

export function RouterStatsWidget({ routerId }: RouterStatsWidgetProps) {
  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['router-bandwidth-stats', routerId],
    queryFn: () => api.routers.bandwidthStats(routerId),
    enabled: Boolean(routerId),
    refetchInterval: 15_000,
    retry: 1,
    retryDelay: 2000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const stats: RouterBandwidthStats | undefined = rawData
    ? unwrap<RouterBandwidthStats>(rawData)
    : undefined;

  const errorMessage = error
    ? (apiError(error, '') || (error as Error | undefined)?.message || 'Erreur')
    : null;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Trafic interfaces</h2>
        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live
        </span>
      </div>

      {errorMessage && !stats ? (
        <p className="text-xs text-muted-foreground">{errorMessage}</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Connexions
              </span>
              <Users className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {isLoading && !stats ? (
                <span className="animate-pulse text-muted-foreground">—</span>
              ) : (
                (stats?.activeConnections ?? 0)
              )}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Upload
              </span>
              <Upload className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <p className="text-lg font-bold tabular-nums text-blue-400">
              {isLoading && !stats ? (
                <span className="animate-pulse text-muted-foreground">—</span>
              ) : (
                formatBytes(stats?.totalTxBytes ?? 0)
              )}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Download
              </span>
              <Download className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="text-lg font-bold tabular-nums text-emerald-400">
              {isLoading && !stats ? (
                <span className="animate-pulse text-muted-foreground">—</span>
              ) : (
                formatBytes(stats?.totalRxBytes ?? 0)
              )}
            </p>
          </div>
        </div>
      )}

      {stats && stats.interfaces.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Interfaces ({stats.interfaces.length})
          </p>
          <div className="space-y-1">
            {stats.interfaces.slice(0, 6).map((iface) => (
              <div
                key={iface.name}
                className="flex items-center justify-between rounded-md border border-white/5 bg-muted/10 px-3 py-1.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${iface.running ? 'bg-emerald-400' : 'bg-muted-foreground'}`}
                  />
                  <span className="font-mono">{iface.name}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>
                    <span className="text-blue-400">{formatBytes(iface.txBytes)}</span>
                    {' ↑'}
                  </span>
                  <span>
                    <span className="text-emerald-400">{formatBytes(iface.rxBytes)}</span>
                    {' ↓'}
                  </span>
                </div>
              </div>
            ))}
            {stats.interfaces.length > 6 && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                +{stats.interfaces.length - 6} autres interfaces
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
