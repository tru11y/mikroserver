import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { clsx } from 'clsx';

interface AuditTimestampProps {
  iso: string;
  className?: string;
}

export function AuditTimestamp({ iso, className }: AuditTimestampProps) {
  const date = new Date(iso);
  const display = format(date, 'dd/MM HH:mm:ss', { locale: fr });
  const full = format(date, "EEEE d MMMM yyyy 'à' HH:mm:ss", { locale: fr });

  return (
    <time
      dateTime={iso}
      title={full}
      className={clsx('tabular-nums text-xs text-muted-foreground', className)}
    >
      {display}
    </time>
  );
}
