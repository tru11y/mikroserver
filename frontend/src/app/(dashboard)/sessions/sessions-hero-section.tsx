'use client';

import { ArrowDown, ArrowUp, Router, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/lib/format';
import type { Session } from './use-sessions-page';

interface SessionsHeroSectionProps {
  sessions: Session[];
  respondingRouters: number;
  totalRouters: number;
  isLoading: boolean;
}

export function SessionsHeroSection({
  sessions,
  respondingRouters,
  totalRouters,
  isLoading,
}: SessionsHeroSectionProps) {
  const totalDown = sessions.reduce((acc, s) => acc + s.bytesIn, 0);
  const totalUp = sessions.reduce((acc, s) => acc + s.bytesOut, 0);

  const kpis = [
    {
      label: 'Clients connectés',
      value: isLoading ? null : sessions.length,
      display: String(sessions.length),
      icon: <Users className="h-4 w-4 text-primary" aria-hidden="true" />,
      sub: 'sessions actives',
    },
    {
      label: 'Routeurs joignables',
      value: isLoading ? null : respondingRouters,
      display: `${respondingRouters}/${totalRouters}`,
      icon: <Router className="h-4 w-4 text-info" aria-hidden="true" />,
      sub: totalRouters > 0 && respondingRouters < totalRouters ? 'certains hors ligne' : 'tous joignables',
      subTone: totalRouters > 0 && respondingRouters < totalRouters ? 'text-warning' : 'text-muted-foreground',
    },
    {
      label: 'Trafic total ↓',
      value: isLoading ? null : totalDown,
      display: formatBytes(totalDown),
      icon: <ArrowDown className="h-4 w-4 text-success" aria-hidden="true" />,
      sub: 'download agrégé',
    },
    {
      label: 'Trafic total ↑',
      value: isLoading ? null : totalUp,
      display: formatBytes(totalUp),
      icon: <ArrowUp className="h-4 w-4 text-info" aria-hidden="true" />,
      sub: 'upload agrégé',
    },
  ] as const;

  return (
    <header>
      <h1 className="text-lg font-semibold tracking-tight">Sessions actives</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Monitoring temps réel des clients hotspot connectés
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                {kpi.icon}
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="mb-1 h-7 w-20" />
            ) : (
              <p className="text-2xl font-bold tabular-nums tracking-tight">{kpi.display}</p>
            )}
            <p className={`mt-1 text-[11px] ${'subTone' in kpi ? kpi.subTone : 'text-muted-foreground'}`}>
              {kpi.sub}
            </p>
          </div>
        ))}
      </div>
    </header>
  );
}
