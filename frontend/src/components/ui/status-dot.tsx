import { clsx } from 'clsx';

export type StatusDotVariant = 'online' | 'offline' | 'warning' | 'maintenance' | 'live';

const dotConfig: Record<StatusDotVariant, { base: string; ping?: boolean }> = {
  online:      { base: 'bg-success',     ping: true },
  live:        { base: 'bg-success',     ping: true },
  warning:     { base: 'bg-warning' },
  offline:     { base: 'bg-destructive' },
  maintenance: { base: 'bg-info' },
};

interface StatusDotProps {
  variant: StatusDotVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusDot({ variant, size = 'sm', className }: StatusDotProps) {
  const cfg = dotConfig[variant];
  const dim = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';

  return (
    <span className={clsx('relative flex shrink-0', dim, className)}>
      {cfg.ping && (
        <span
          className={clsx(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            cfg.base,
          )}
        />
      )}
      <span className={clsx('relative inline-flex rounded-full h-full w-full', cfg.base)} />
    </span>
  );
}
