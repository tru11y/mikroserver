import { clsx } from 'clsx';

interface RouterStatusBadgeProps {
  status?: string;
  className?: string;
}

type StatusConfig = {
  label: string;
  color: string;
  bg: string;
  dot: string;
  ping: boolean;
  pulse: boolean;
};

function getStatusConfig(status?: string): StatusConfig {
  switch (status) {
    case 'ONLINE':
      return {
        label: 'En ligne',
        color: 'text-success',
        bg: 'bg-success/10 border-success/20',
        dot: 'bg-success',
        ping: true,
        pulse: false,
      };
    case 'DEGRADED':
      return {
        label: 'Dégradé',
        color: 'text-warning',
        bg: 'bg-warning/10 border-warning/20',
        dot: 'bg-warning',
        ping: false,
        pulse: true,
      };
    case 'MAINTENANCE':
      return {
        label: 'Maintenance',
        color: 'text-warning',
        bg: 'bg-warning/10 border-warning/20',
        dot: 'bg-warning',
        ping: false,
        pulse: false,
      };
    default:
      return {
        label: 'Hors ligne',
        color: 'text-destructive',
        bg: 'bg-destructive/10 border-destructive/20',
        dot: 'bg-destructive',
        ping: false,
        pulse: false,
      };
  }
}

export function RouterStatusBadge({ status, className }: RouterStatusBadgeProps) {
  const cfg = getStatusConfig(status);
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150',
        cfg.bg,
        cfg.color,
        className,
      )}
    >
      {cfg.ping ? (
        <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
          <span
            className={clsx(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              cfg.dot,
            )}
          />
          <span
            className={clsx('relative inline-flex h-2 w-2 rounded-full', cfg.dot)}
          />
        </span>
      ) : (
        <span
          className={clsx(
            'h-1.5 w-1.5 flex-shrink-0 rounded-full',
            cfg.dot,
            cfg.pulse && 'animate-pulse',
          )}
          aria-hidden="true"
        />
      )}
      {cfg.label}
    </span>
  );
}
