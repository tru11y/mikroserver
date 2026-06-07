'use client';

import { AlertTriangle, ArrowLeft, Download, Upload, Users, Wifi } from 'lucide-react';
import type { LiveStats, RouterDetail, SyncSummary } from './router-detail.types';
import { formatBps, formatBytes, formatRelative } from './router-detail.utils';
import { RouterHeaderIdentity } from './router-header-identity';
import { RouterHeaderActions } from './router-header-actions';
import { RouterKpiCard } from './router-kpi-card';
import { RouterOfflineBanner } from './router-offline-banner';
import { KpiCardSkeleton } from '@/components/ui/skeleton';

interface RouterOverviewSectionProps {
  routerInfo?: RouterDetail;
  stats?: LiveStats;
  statsLoading: boolean;
  statsErrorMessage?: string | null;
  dataUpdatedAt: number;
  maxBps: number;
  portalHref: string;
  canSyncRouters: boolean;
  canRunHealthCheck: boolean;
  isSyncPending: boolean;
  isChecking: boolean;
  onBack: () => void;
  onOpenPortal: () => void;
  onSync: () => void;
  onHealthCheck: () => void;
}

function BandwidthBar({
  value,
  max,
  colorClass,
}: {
  value: number;
  max: number;
  colorClass: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-muted"
      style={{ '--bar-pct': `${pct}%` } as React.CSSProperties}
    >
      <div
        className={`h-full w-[var(--bar-pct)] rounded-full transition-all duration-500 ${colorClass}`}
      />
    </div>
  );
}

export function RouterOverviewSection({
  routerInfo,
  stats,
  statsLoading,
  statsErrorMessage,
  dataUpdatedAt,
  maxBps,
  portalHref,
  canSyncRouters,
  canRunHealthCheck,
  isSyncPending,
  isChecking,
  onBack,
  onOpenPortal,
  onSync,
  onHealthCheck,
}: RouterOverviewSectionProps) {
  const metadata = routerInfo?.metadata ?? {};
  const syncSummary: SyncSummary | undefined = stats?.syncSummary;
  const unmatchedUsers =
    syncSummary?.unmatchedUsers ??
    (Array.isArray(metadata.lastUnmatchedUsers) ? metadata.lastUnmatchedUsers : []);
  const managedClients = syncSummary?.matchedVouchers ?? metadata.lastMatchedVouchers ?? 0;
  const unmanagedClients = unmatchedUsers.length;
  const lastHealthError = metadata.lastHealthCheckError;
  const lastSyncError = metadata.lastSyncError;
  const isHealthCheckStale =
    routerInfo?.status === 'OFFLINE' &&
    metadata.lastHealthCheckAt != null &&
    Date.now() - new Date(metadata.lastHealthCheckAt).getTime() > 10 * 60 * 1000;
  const staleActiveClients = metadata.lastActiveClients;
  const activeClientsValue = stats?.activeClients ?? staleActiveClients ?? 0;
  const isUsingStaleActiveClients =
    !stats && typeof staleActiveClients === 'number' && staleActiveClients > 0;

  return (
    <>
      {/* Offline / degraded banner */}
      {routerInfo?.status && routerInfo.status !== 'ONLINE' && (
        <RouterOfflineBanner
          status={routerInfo.status}
          lastHealthCheckAt={metadata.lastHealthCheckAt}
          lastHealthCheckError={lastHealthError}
        />
      )}

      {/* Header */}
      <header className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour aux routeurs"
          className="mt-0.5 flex-shrink-0 rounded-lg border p-2 transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <RouterHeaderIdentity routerInfo={routerInfo} />
        <RouterHeaderActions
          routerInfo={routerInfo}
          dataUpdatedAt={dataUpdatedAt}
          canSyncRouters={canSyncRouters}
          canRunHealthCheck={canRunHealthCheck}
          isSyncPending={isSyncPending}
          isChecking={isChecking}
          onOpenPortal={onOpenPortal}
          onSync={onSync}
          onHealthCheck={onHealthCheck}
        />
      </header>

      {/* Diagnostics banner */}
      {(lastHealthError || lastSyncError || statsErrorMessage) && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <div className="flex items-start gap-2 text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">Derniers diagnostics du routeur</p>
              {lastHealthError && <p>Health check : {lastHealthError}</p>}
              {lastSyncError && <p>Synchronisation : {lastSyncError}</p>}
              {statsErrorMessage && <p>Lecture live : {statsErrorMessage}</p>}
            </div>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statsLoading && !stats ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <RouterKpiCard
              label="Clients actifs"
              icon={Users}
              gradientClass="from-primary/5"
              iconBgClass="bg-primary/10"
              iconColorClass="text-primary"
              valueSizeClass="text-4xl"
              value={activeClientsValue}
              subtitle={
                isUsingStaleActiveClients
                  ? 'Dernière mesure connue'
                  : `sur ${routerInfo?.hotspotServer ?? 'hotspot'}`
              }
            />
            <RouterKpiCard
              label="Download"
              icon={Download}
              gradientClass="from-success/5"
              iconBgClass="bg-success/10"
              iconColorClass="text-success"
              valueColorClass="text-success"
              valueSizeClass="text-2xl"
              value={formatBps(stats?.rxBytesPerSec ?? 0)}
              subtitle={`Total : ${stats ? formatBytes(stats.totalBytesIn) : '—'}`}
            >
              <BandwidthBar
                value={stats?.rxBytesPerSec ?? 0}
                max={maxBps}
                colorClass="bg-success"
              />
            </RouterKpiCard>
            <RouterKpiCard
              label="Upload"
              icon={Upload}
              gradientClass="from-info/5"
              iconBgClass="bg-info/10"
              iconColorClass="text-info"
              valueColorClass="text-info"
              valueSizeClass="text-2xl"
              value={formatBps(stats?.txBytesPerSec ?? 0)}
              subtitle={`Total : ${stats ? formatBytes(stats.totalBytesOut) : '—'}`}
            >
              <BandwidthBar
                value={stats?.txBytesPerSec ?? 0}
                max={maxBps}
                colorClass="bg-info"
              />
            </RouterKpiCard>
            <RouterKpiCard
              label="Tickets appariés"
              icon={Wifi}
              gradientClass="from-primary/5"
              iconBgClass="bg-primary/10"
              iconColorClass="text-primary"
              valueSizeClass="text-2xl"
              value={managedClients}
              subtitle={`${unmanagedClients} utilisateur(s) non géré(s)`}
            />
          </>
        )}
      </div>

      {/* Sync diagnostic + API state */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section
          aria-labelledby="sync-diagnostic-heading"
          className="space-y-4 rounded-xl border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 id="sync-diagnostic-heading" className="font-semibold">
                Diagnostic de synchronisation
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Compare les sessions hotspot actives avec les tickets connus par la plateforme
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              Dernière sync {formatRelative(syncSummary?.fetchedAt ?? metadata.lastSyncAt)}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Clients hotspot',
                value: syncSummary?.activeClients ?? metadata.lastActiveClients ?? 0,
              },
              { label: 'Tickets appariés', value: managedClients },
              {
                label: 'Activés par la sync',
                value: syncSummary?.activatedVouchers ?? metadata.lastActivatedVouchers ?? 0,
              },
              {
                label: 'Sessions fermées',
                value:
                  syncSummary?.disconnectedSessions ??
                  metadata.lastDisconnectedSessions ??
                  0,
              },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>

          {unmatchedUsers.length > 0 ? (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
              <p className="text-sm font-medium text-warning">
                Utilisateurs hotspot non gérés par MikroServer
              </p>
              <p className="mt-1 text-xs text-warning/80">
                Connectés sur le routeur, mais sans ticket actif connu par la plateforme.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {unmatchedUsers.slice(0, 12).map((username) => (
                  <span
                    key={username}
                    className="rounded-full border border-warning/30 px-2.5 py-1 text-xs font-mono text-warning"
                  >
                    {username}
                  </span>
                ))}
                {unmatchedUsers.length > 12 && (
                  <span className="rounded-full border border-warning/30 px-2.5 py-1 text-xs text-warning">
                    +{unmatchedUsers.length - 12} autres
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
              Tous les utilisateurs actifs vus sur ce hotspot sont connus par la plateforme.
            </div>
          )}
        </section>

        <section
          aria-labelledby="api-state-heading"
          className="space-y-4 rounded-xl border bg-card p-5"
        >
          <div>
            <h2 id="api-state-heading" className="font-semibold">
              État API
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Santé du lien WireGuard + RouterOS API
            </p>
          </div>

          <div className="space-y-3 text-sm">
            {[
              {
                label: 'Dernier health check',
                value: formatRelative(metadata.lastHealthCheckAt),
                mono: false,
              },
              {
                label: 'Dernière sync',
                value: formatRelative(metadata.lastSyncAt),
                mono: false,
              },
              {
                label: 'Utilisateur API',
                value: routerInfo?.apiUsername ?? '—',
                mono: true,
              },
              {
                label: 'Serveur hotspot',
                value: routerInfo?.hotspotServer ?? '—',
                mono: false,
              },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className={mono ? 'font-mono text-xs' : undefined}>{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Portail</span>
              <a
                href={portalHref}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Ouvrir
              </a>
            </div>
          </div>

          {isHealthCheckStale && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
              Le cron health check ne semble plus tourner — dernier check{' '}
              {formatRelative(metadata.lastHealthCheckAt)}. Vérifier les logs du backend (
              <code className="font-mono">docker logs api --tail=50</code>).
            </div>
          )}
          {lastHealthError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              Dernière erreur API : {lastHealthError}
            </div>
          ) : (
            <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success">
              Aucun incident API enregistré lors du dernier check.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
