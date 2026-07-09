import { clsx } from 'clsx';

type AccessStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

interface AccessStatusBadgeProps {
  status: AccessStatus;
  className?: string;
}

const cfg: Record<AccessStatus, { label: string; color: string; bg: string; dot: string; ping: boolean }> = {
  ACTIVE: {
    label: 'Actif',
    color: 'text-success',
    bg: 'bg-success/10 border-success/20',
    dot: 'bg-success',
    ping: false,
  },
  SUSPENDED: {
    label: 'Suspendu',
    color: 'text-destructive',
    bg: 'bg-destructive/10 border-destructive/20',
    dot: 'bg-destructive',
    ping: false,
  },
  PENDING_VERIFICATION: {
    label: 'En attente',
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/20',
    dot: 'bg-warning',
    ping: false,
  },
};

export function AccessStatusBadge({ status, className }: AccessStatusBadgeProps) {
  const c = cfg[status] ?? cfg.SUSPENDED;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        c.bg,
        c.color,
        className,
      )}
    >
      {c.ping ? (
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className={clsx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', c.dot)} />
          <span className={clsx('relative inline-flex h-2 w-2 rounded-full', c.dot)} />
        </span>
      ) : (
        <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', c.dot)} aria-hidden="true" />
      )}
      {c.label}
    </span>
  );
}
