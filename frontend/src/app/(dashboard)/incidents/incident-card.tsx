'use client';

import Link from 'next/link';
import { Clock3, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { IncidentIcon } from './incident-icon';
import { IncidentSeverityBadge } from './incident-severity-badge';
import { IncidentTimestamp } from './incident-timestamp';
import type { IncidentItem, IncidentSeverity } from './incidents.types';

interface IncidentCardProps {
  incident: IncidentItem;
}

const BORDER_LEFT: Record<IncidentSeverity, string> = {
  CRITICAL: 'border-l-destructive',
  HIGH:     'border-l-warning',
  MEDIUM:   'border-l-warning/50',
  LOW:      'border-l-border',
};

const ICON_COLOR: Record<IncidentSeverity, string> = {
  CRITICAL: 'text-destructive',
  HIGH:     'text-warning',
  MEDIUM:   'text-warning/80',
  LOW:      'text-muted-foreground',
};

export function IncidentCard({ incident }: IncidentCardProps) {
  return (
    <article
      className={clsx(
        'rounded-lg border border-l-4 bg-muted/20 p-4',
        'transition-all duration-200 ease-out',
        'hover:bg-card/60 hover:shadow-[var(--shadow-sm)]',
        BORDER_LEFT[incident.severity],
      )}
      aria-label={incident.title}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={clsx('shrink-0', ICON_COLOR[incident.severity])}>
              <IncidentIcon type={incident.type} severity={incident.severity} />
            </span>
            <h3 className="truncate font-medium text-sm">{incident.title}</h3>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            {incident.description}
          </p>
        </div>
        <IncidentSeverityBadge severity={incident.severity} className="flex-shrink-0" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" aria-hidden="true" />
          <IncidentTimestamp iso={incident.detectedAt} />
        </span>

        {incident.routerId && incident.routerName && (
          <Link
            href={`/routers/${incident.routerId}`}
            aria-label={`Voir le routeur ${incident.routerName}`}
            className={clsx(
              'inline-flex items-center gap-1 rounded px-1 py-0.5',
              'transition-all duration-200 ease-out',
              'hover:text-foreground active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-background',
            )}
          >
            {incident.routerName}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
        )}

        {incident.type === 'QUEUE_BACKLOG' && incident.entityId && (
          <span>File : {incident.entityId}</span>
        )}
      </div>
    </article>
  );
}
