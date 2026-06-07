'use client';

import { Loader2, WifiOff, Wifi } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ActiveSession {
  id: string;
  ipAddress: string | null;
  startedAt: string;
  voucher: { code: string; plan: { name: string } | null } | null;
}

interface CustomerSessionsSectionProps {
  sessions: ActiveSession[];
  isDisconnectPending: boolean;
  onDisconnect: (sessionId: string) => void;
}

export function CustomerSessionsSection({
  sessions,
  isDisconnectPending,
  onDisconnect,
}: CustomerSessionsSectionProps) {
  if (sessions.length === 0) return null;

  return (
    <section
      aria-labelledby="customer-sessions-heading"
      className="bg-card border rounded-xl p-5 space-y-3"
    >
      <h2
        id="customer-sessions-heading"
        className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"
      >
        <Wifi className="h-4 w-4 text-success" aria-hidden="true" />
        Sessions actives
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-success/10 px-1.5 text-[10px] font-bold text-success tabular-nums">
          {sessions.length}
        </span>
      </h2>
      <ul className="space-y-2" role="list">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm gap-3"
          >
            <div className="space-y-0.5 min-w-0">
              <p className="font-mono text-xs text-muted-foreground">
                {session.ipAddress ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {session.voucher?.plan?.name ?? 'Voucher'} &middot; {session.voucher?.code ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                Depuis{' '}
                {formatDistanceToNow(new Date(session.startedAt), {
                  addSuffix: true,
                  locale: fr,
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDisconnect(session.id)}
              disabled={isDisconnectPending}
              aria-label={`Déconnecter la session ${session.ipAddress ?? ''}`}
              className="inline-flex shrink-0 items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isDisconnectPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Déconnecter
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
