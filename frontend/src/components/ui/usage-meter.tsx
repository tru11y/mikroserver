import { ReactNode } from 'react';
import { clsx } from 'clsx';

export type UrgencyLevel = 'ok' | 'medium' | 'high' | 'critical';

const URGENCY_BAR: Record<UrgencyLevel, string> = {
  ok:       'bg-[hsl(var(--success))]',
  medium:   'bg-[hsl(var(--warning))]',
  high:     'bg-[hsl(var(--warning))]',
  critical: 'bg-[hsl(var(--destructive))]',
};

export function pctToUrgency(pct: number): UrgencyLevel {
  if (pct >= 90) return 'critical';
  if (pct >= 70) return 'high';
  if (pct >= 60) return 'medium';
  return 'ok';
}

interface UsageMeterProps {
  label: string;
  icon: ReactNode;
  current: number;
  limit: number | null;
  urgencyLevel: UrgencyLevel;
}

export function UsageMeter({ label, icon, current, limit, urgencyLevel }: UsageMeterProps) {
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 0 : Math.min(100, (current / limit) * 100);

  const ariaProps = isUnlimited
    ? {}
    : {
        role: 'progressbar' as const,
        'aria-valuenow': current,
        'aria-valuemax': limit,
        'aria-label': `${label} : ${current} sur ${limit}`,
      };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-semibold tabular-nums">
          {current}
          <span className="text-muted-foreground font-normal">/{limit ?? '∞'}</span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden" {...ariaProps}>
        {isUnlimited ? (
          <div className="h-full w-full rounded-full bg-[hsl(var(--success)/0.3)]" />
        ) : (
          <div
            className={clsx('h-full rounded-full transition-all duration-300', URGENCY_BAR[urgencyLevel])}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
