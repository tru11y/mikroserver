'use client';

import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { StatusDot } from '@/components/ui/status-dot';

interface KpiCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: { value: number; label: string; alert?: boolean; direction?: 'up' | 'down' };
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  /** Short contextual hint shown below the value */
  hint?: string;
  /** Pulsing live indicator next to value */
  live?: boolean;
  /** Compact mode: less padding, smaller text — for KPI strip rows */
  compact?: boolean;
}

const cfg = {
  primary: {
    gradient: 'from-primary/20 via-primary/5',
    glow: 'shadow-glow',
    icon: 'bg-primary/15 text-primary ring-1 ring-primary/20',
    value: '',
    trend: 'text-primary',
  },
  success: {
    gradient: 'from-success/20 via-success/5',
    glow: 'shadow-[0_0_0_1px_hsl(var(--success)/0.15),0_4px_20px_-2px_hsl(var(--success)/0.20)]',
    icon: 'bg-success/15 text-success ring-1 ring-success/20',
    value: 'text-success',
    trend: 'text-success',
  },
  warning: {
    gradient: 'from-warning/20 via-warning/5',
    glow: 'shadow-[0_0_0_1px_hsl(var(--warning)/0.15),0_4px_20px_-2px_hsl(var(--warning)/0.20)]',
    icon: 'bg-warning/15 text-warning ring-1 ring-warning/20',
    value: 'text-warning',
    trend: 'text-warning',
  },
  danger: {
    gradient: 'from-destructive/20 via-destructive/5',
    glow: 'shadow-[0_0_0_1px_hsl(var(--destructive)/0.15),0_4px_20px_-2px_hsl(var(--destructive)/0.20)]',
    icon: 'bg-destructive/15 text-destructive ring-1 ring-destructive/20',
    value: 'text-destructive',
    trend: 'text-destructive',
  },
  neutral: {
    gradient: 'from-muted/30 via-muted/10',
    glow: '',
    icon: 'bg-muted text-foreground ring-1 ring-border',
    value: '',
    trend: 'text-muted-foreground',
  },
};

export function KpiCard({
  title,
  value,
  icon,
  trend,
  hint,
  live,
  compact = false,
  variant = 'primary',
}: KpiCardProps) {
  const c = cfg[variant];

  if (compact) {
    return (
      <div
        className={clsx(
          'rounded-lg border bg-card p-4',
          'transition-all duration-200 ease-out',
          'hover:shadow-md hover:border-primary/30',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
          <div className={clsx('h-7 w-7 rounded-md flex items-center justify-center shrink-0', c.icon)}>
            {icon}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <p className={clsx('text-2xl font-bold tracking-tight tabular-nums leading-none', c.value)}>
            {value}
          </p>
          {live && (
            <span className="mb-0.5 flex items-center gap-1">
              <StatusDot variant="live" size="sm" />
              <span className="text-[10px] font-semibold text-success uppercase tracking-wider">Live</span>
            </span>
          )}
        </div>
        {hint && (
          <p className="mt-2 text-xs text-muted-foreground truncate">{hint}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl border border-border/60 bg-card/80',
        'shadow-md transition-all duration-200',
        'hover:shadow-lg hover:-translate-y-0.5 hover:border-border',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
        c.glow,
        'group',
      )}
    >
      <div
        className={clsx(
          'pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-60',
          c.gradient,
        )}
      />
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-radial from-current to-transparent opacity-[0.06]" />

      <div className="relative p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
          <div className={clsx('flex-shrink-0 rounded-lg p-2.5', c.icon)}>
            {icon}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <p className={clsx('text-3xl font-bold tracking-tight tabular-nums', c.value)}>
            {value}
          </p>
          {live && (
            <span className="mb-1 flex items-center gap-1">
              <StatusDot variant="live" size="md" />
              <span className="text-[10px] font-semibold text-success uppercase tracking-wider">Live</span>
            </span>
          )}
        </div>

        {hint && (
          <p className="mt-1.5 text-xs text-muted-foreground truncate">{hint}</p>
        )}

        {trend && (
          <div className="mt-2.5 flex items-center gap-1.5">
            {trend.alert ? (
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-warning" />
            ) : trend.direction === 'down' ? (
              <TrendingDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            )}
            <span
              className={clsx(
                'text-xs font-medium',
                trend.alert ? 'text-warning' : 'text-muted-foreground',
              )}
            >
              {trend.value > 0 ? '+' : ''}{trend.value} {trend.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
