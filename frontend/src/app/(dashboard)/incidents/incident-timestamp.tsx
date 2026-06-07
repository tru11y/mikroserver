'use client';

import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { clsx } from 'clsx';

interface IncidentTimestampProps {
  iso: string;
  className?: string;
}

export function IncidentTimestamp({ iso, className }: IncidentTimestampProps) {
  const relative = formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
  return (
    <time
      dateTime={iso}
      title={new Date(iso).toLocaleString('fr-CI')}
      className={clsx('tabular-nums', className)}
    >
      {relative}
    </time>
  );
}
