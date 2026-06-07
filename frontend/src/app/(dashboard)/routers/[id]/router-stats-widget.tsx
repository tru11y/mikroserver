'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, Upload, Users } from 'lucide-react';
import { api, unwrap, apiError } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { formatBytes } from './router-detail.utils';

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

interface RouterStatsWidgetProps {
  routerId: string;
}

export function RouterStatsWidget({ routerId }: RouterStatsWidgetProps) {
  const { data: rawData, isLoading, error, refetch } = useQuery({
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

  const isInitialLoading = isLoading && !stats;

  return (
    <section
      aria-labelledby="stats-widget-heading"
      className="rounded-xl border bg-card p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="stats-widget-heading" className="font-semibold">
          Trafic interfaces
        </h2>
        {!isInitialLoading && !errorMessage && (
          <span className="flex items-center gap-1.5 text-xs text-success">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-success"
              aria-hidden="true"
            />
            Live
          </span>
        )}
      </div>

      {/* Initial loading skeleton */}
      {isInitialLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3.5 w-3.5 rounded-full" />
              </div>
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Error state (no data at all) */}
      {errorMessage && !stats && (
        <ErrorState
          title="Trafic interfaces indisponible"
          message={errorMessage}
          onRetry={() => void refetch()}
          variant="inline"
        />
      )}

      {/* Data */}
      {!isInitialLoading && stats && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Connexions
                </span>
                <Users className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              </div>
              <p className="text-xl font-bold tabular-nums sm:text-2xl">
                {stats.activeConnections}
              </p>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Upload
                </span>
                <Upload className="h-3.5 w-3.5 text-info" aria-hidden="true" />
              </div>
              <p className="text-lg font-bold tabular-nums text-info sm:text-xl">
                {formatBytes(stats.totalTxBytes)}
              </p>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Download
                </span>
                <Download className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              </div>
              <p className="text-lg font-bold tabular-nums text-success sm:text-xl">
                {formatBytes(stats.totalRxBytes)}
              </p>
            </div>
          </div>

          {stats.interfaces.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                        className={`h-1.5 w-1.5 rounded-full ${
                          iface.running ? 'bg-success' : 'bg-muted-foreground'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="font-mono">{iface.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>
                        <span className="text-info">{formatBytes(iface.txBytes)}</span>
                        {' ↑'}
                      </span>
                      <span>
                        <span className="text-success">{formatBytes(iface.rxBytes)}</span>
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
        </>
      )}
    </section>
  );
}
