'use client';

import Link from 'next/link';
import { StatusDot } from '@/components/ui/status-dot';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { formatDuration } from '@/lib/formatters';
import { Activity } from 'lucide-react';

interface SessionRow {
  id:              string;
  username:        string;
  macAddress:      string;
  routerName:      string;
  createdAt:       string;
  durationSeconds: number;
}

interface SessionsResult {
  items:             unknown[];
  totalRouters:      number;
  respondingRouters: number;
}

interface DashboardSessionsSectionProps {
  sessions:    SessionRow[];
  liveCount:   number | null;
  liveResult:  SessionsResult | undefined;
  isLoading:   boolean;
  isError?:    boolean;
  onRetry?:    () => void;
}

const TABLE_HEADERS = [
  { label: 'Utilisateur', className: '' },
  { label: 'Adresse MAC', className: 'hidden sm:table-cell' },
  { label: 'Routeur',     className: '' },
  { label: 'Durée',       className: '' },
] as const;

export function DashboardSessionsSection({
  sessions,
  liveCount,
  liveResult,
  isLoading,
  isError,
  onRetry,
}: DashboardSessionsSectionProps) {
  const hasLive = (liveCount ?? 0) > 0;

  return (
    <section
      aria-labelledby="sessions-heading"
      className="rounded-lg border bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          {hasLive ? (
            <StatusDot variant="live" size="md" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
          )}
          <h3 id="sessions-heading" className="font-semibold text-sm">
            Dernières sessions
          </h3>
          {hasLive && (
            <span className="text-[10px] font-semibold text-success uppercase tracking-wider">
              {liveCount} live
            </span>
          )}
        </div>
        <Link
          href="/sessions"
          className="text-xs text-primary hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
        >
          Tout voir →
        </Link>
      </div>

      {isError ? (
        <div className="p-4">
          <ErrorState
            variant="inline"
            title="Impossible de charger les sessions"
            onRetry={onRetry}
          />
        </div>
      ) : isLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
          <Activity className="h-7 w-7 opacity-30" />
          <p className="text-xs">Aucune session récente</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {TABLE_HEADERS.map((h) => (
                  <th
                    key={h.label}
                    scope="col"
                    className={`px-4 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest ${h.className}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs font-medium">{session.username}</td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs hidden sm:table-cell">
                    {session.macAddress || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{session.routerName}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                    {formatDuration(session.durationSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
