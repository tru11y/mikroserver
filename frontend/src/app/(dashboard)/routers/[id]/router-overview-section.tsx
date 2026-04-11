'use client';

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Clock,
  Download,
  ExternalLink,
  Globe,
  MapPin,
  Monitor,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Upload,
  Users,
  Wifi,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { LiveStats, RouterDetail, SyncSummary } from './router-detail.types';
import { formatBps, formatBytes, formatRelative } from './router-detail.utils';

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
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={clsx('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function getStatusConfig(status?: string) {
  if (status === 'ONLINE') {
    return {
      label: 'En ligne',
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10 border-emerald-400/20',
      dot: 'bg-emerald-400',
    };
  }

  if (status === 'DEGRADED') {
    return {
      label: 'Degrade',
      color: 'text-orange-300',
      bg: 'bg-orange-400/10 border-orange-400/20',
      dot: 'bg-orange-400',
    };
  }

  if (status === 'MAINTENANCE') {
    return {
      label: 'Maintenance',
      color: 'text-amber-300',
      bg: 'bg-amber-400/10 border-amber-400/20',
      dot: 'bg-amber-400',
    };
  }

  return {
    label: 'Hors ligne',
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20',
    dot: 'bg-red-400',
  };
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
  const statusCfg = getStatusConfig(routerInfo?.status);
  const metadata = routerInfo?.metadata ?? {};
  const syncSummary: SyncSummary | undefined = stats?.syncSummary;
  const unmatchedUsers =
    syncSummary?.unmatchedUsers ??
    (Array.isArray(metadata.lastUnmatchedUsers) ? metadata.lastUnmatchedUsers : []);
  const managedClients = syncSummary?.matchedVouchers ?? metadata.lastMatchedVouchers ?? 0;
  const unmanagedClients = unmatchedUsers.length;
  const lastHealthError = metadata.lastHealthCheckError;
  const lastSyncError = metadata.lastSyncError;
  const staleActiveClients = metadata.lastActiveClients;
  const activeClientsValue = stats?.activeClients ?? staleActiveClients ?? 0;
  const isUsingStaleActiveClients =
    !stats && typeof staleActiveClients === 'number' && staleActiveClients > 0;

  return (
    <>
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="mt-0.5 rounded-lg border p-2 transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {routerInfo?.name ?? '...'}
            </h1>
            {routerInfo && (
              <span
                className={clsx(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                  statusCfg.bg,
                  statusCfg.color,
                )}
              >
                <span
                  className={clsx(
                    'h-1.5 w-1.5 rounded-full',
                    statusCfg.dot,
                    ['ONLINE', 'DEGRADED'].includes(routerInfo.status ?? '') && 'animate-pulse',
                  )}
                />
                {statusCfg.label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {routerInfo?.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {routerInfo.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Server className="h-3 w-3" />
              {routerInfo?.wireguardIp ?? '—'}:{routerInfo?.apiPort}
            </span>
            {routerInfo?.lastSeenAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Vu {formatRelative(routerInfo.lastSeenAt)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Hotspot {routerInfo?.hotspotServer ?? '—'} · profil{' '}
              {routerInfo?.hotspotProfile ?? '—'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Radio className="h-3 w-3 text-emerald-400" />
              Live · {new Date(dataUpdatedAt).toLocaleTimeString('fr-FR')}
            </span>
          )}
          {routerInfo?.wireguardIp && (
            <>
              <a
                href={`http://${routerInfo.wireguardIp}/`}
                target="_blank"
                rel="noopener noreferrer"
                title={`WebFig — IP WireGuard ${routerInfo.wireguardIp} · Nécessite d'être connecté au tunnel VPN`}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Globe className="h-4 w-4" />
                WebFig
              </a>
              <a
                href={`winbox://${routerInfo.wireguardIp}`}
                title={`Winbox — IP WireGuard ${routerInfo.wireguardIp} · Nécessite Winbox installé et le tunnel VPN actif`}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Monitor className="h-4 w-4" />
                Winbox
              </a>
            </>
          )}
          <button
            onClick={onOpenPortal}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" />
            Apercu portail
          </button>
          {canSyncRouters && (
            <button
              onClick={onSync}
              disabled={isSyncPending}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                className={clsx('h-4 w-4', isSyncPending && 'animate-spin')}
              />
              {isSyncPending ? 'Sync...' : 'Synchroniser'}
            </button>
          )}
          {canRunHealthCheck && (
            <button
              onClick={onHealthCheck}
              disabled={isChecking}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Activity className={clsx('h-4 w-4', isChecking && 'animate-spin')} />
              {isChecking ? 'Test...' : 'Test API'}
            </button>
          )}
        </div>
      </div>

      {(lastHealthError || lastSyncError || statsErrorMessage) && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm">
          <div className="flex items-start gap-2 text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Derniers diagnostics du routeur</p>
              {lastHealthError && <p>Health check: {lastHealthError}</p>}
              {lastSyncError && <p>Synchronisation: {lastSyncError}</p>}
              {statsErrorMessage && <p>Lecture live: {statsErrorMessage}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl border bg-card p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Clients actifs
              </span>
              <div className="rounded-lg bg-primary/10 p-1.5">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-4xl font-bold tabular-nums">
              {statsLoading ? (
                <span className="animate-pulse text-muted-foreground">—</span>
              ) : (
                activeClientsValue
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isUsingStaleActiveClients
                ? 'Derniere mesure connue'
                : `sur ${routerInfo?.hotspotServer ?? 'hotspot'}`}
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border bg-card p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Download
              </span>
              <div className="rounded-lg bg-emerald-500/10 p-1.5">
                <Download className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-400">
              {statsLoading ? '—' : formatBps(stats?.rxBytesPerSec ?? 0)}
            </p>
            <div className="mt-2">
              <BandwidthBar
                value={stats?.rxBytesPerSec ?? 0}
                max={maxBps}
                color="bg-emerald-400"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total: {formatBytes(stats?.totalBytesIn ?? 0)}
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border bg-card p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Upload
              </span>
              <div className="rounded-lg bg-blue-500/10 p-1.5">
                <Upload className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums text-blue-400">
              {statsLoading ? '—' : formatBps(stats?.txBytesPerSec ?? 0)}
            </p>
            <div className="mt-2">
              <BandwidthBar
                value={stats?.txBytesPerSec ?? 0}
                max={maxBps}
                color="bg-blue-400"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total: {formatBytes(stats?.totalBytesOut ?? 0)}
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border bg-card p-5">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tickets appariés
              </span>
              <div className="rounded-lg bg-violet-500/10 p-1.5">
                <Wifi className="h-4 w-4 text-violet-400" />
              </div>
            </div>
            <p className="text-2xl font-bold">{managedClients}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {unmanagedClients} utilisateur(s) non géré(s)
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Diagnostic de synchronisation</h2>
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
                value:
                  syncSummary?.activatedVouchers ?? metadata.lastActivatedVouchers ?? 0,
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
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4">
              <p className="text-sm font-medium text-amber-300">
                Utilisateurs hotspot non gérés par MikroServer
              </p>
              <p className="mt-1 text-xs text-amber-200/90">
                Ils sont connectés sur le routeur, mais ne correspondent pas à un ticket actif connu par la plateforme.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {unmatchedUsers.slice(0, 12).map((username) => (
                  <span
                    key={username}
                    className="rounded-full border border-amber-400/30 px-2.5 py-1 text-xs font-mono text-amber-100"
                  >
                    {username}
                  </span>
                ))}
                {unmatchedUsers.length > 12 && (
                  <span className="rounded-full border border-amber-400/30 px-2.5 py-1 text-xs text-amber-100">
                    +{unmatchedUsers.length - 12} autres
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-300">
              Tous les utilisateurs actifs vus sur ce hotspot sont connus par la plateforme.
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h2 className="font-semibold">État API</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Santé du lien WireGuard + RouterOS API
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dernier health check</span>
              <span>{formatRelative(metadata.lastHealthCheckAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dernière sync</span>
              <span>{formatRelative(metadata.lastSyncAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Utilisateur API</span>
              <span className="font-mono text-xs">{routerInfo?.apiUsername ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Serveur hotspot</span>
              <span>{routerInfo?.hotspotServer ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Portail</span>
              <a
                href={portalHref}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Ouvrir
              </a>
            </div>
          </div>

          {lastHealthError ? (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-300">
              Dernière erreur API: {lastHealthError}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-300">
              Aucun incident API enregistré lors du dernier check.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
