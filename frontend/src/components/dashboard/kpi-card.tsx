'use client';

import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: { value: number; label: string; alert?: boolean; direction?: 'up' | 'down' };
  variant?: 'primary' | 'success' | 'warning' | 'danger';
}

const cfg = {
  primary: {
    gradient: 'from-primary/20 via-primary/5',
    glow: 'shadow-glow',
    icon: 'bg-primary/15 text-primary ring-1 ring-primary/20',
    trend: 'text-primary',
  },
  success: {
    gradient: 'from-emerald-500/20 via-emerald-500/5',
    glow: 'shadow-[0_0_0_1px_hsl(145_63%_32%/0.15),0_4px_20px_-2px_hsl(145_63%_32%/0.20)]',
    icon: 'bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/20',
    trend: 'text-emerald-500',
  },
  warning: {
    gradient: 'from-amber-500/20 via-amber-500/5',
    glow: 'shadow-[0_0_0_1px_hsl(38_96%_46%/0.15),0_4px_20px_-2px_hsl(38_96%_46%/0.20)]',
    icon: 'bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/20',
    trend: 'text-amber-500',
  },
  danger: {
    gradient: 'from-red-500/20 via-red-500/5',
    glow: 'shadow-[0_0_0_1px_hsl(0_84%_55%/0.15),0_4px_20px_-2px_hsl(0_84%_55%/0.20)]',
    icon: 'bg-red-500/15 text-red-500 ring-1 ring-red-500/20',
    trend: 'text-red-500',
  },
};

export function KpiCard({ title, value, icon, trend, variant = 'primary' }: KpiCardProps) {
  const c = cfg[variant];
  return (
    <div
      className={clsx(
        // Base card — glassmorphism on dark, clean elevation on light
        'relative overflow-hidden rounded-xl border border-border/60 bg-card/80',
        'shadow-md transition-all duration-200',
        'hover:shadow-lg hover:-translate-y-0.5 hover:border-border',
        // Subtle glow ring on hover via group
        'group',
      )}
    >
      {/* Gradient wash behind content */}
      <div
        className={clsx(
          'pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-60',
          c.gradient,
        )}
      />
      {/* Top-right accent spot */}
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

        <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>

        {trend && (
          <div className="mt-2.5 flex items-center gap-1.5">
            {trend.alert ? (
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
            ) : trend.direction === 'down' ? (
              <TrendingDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            )}
            <span
              className={clsx(
                'text-xs font-medium',
                trend.alert ? 'text-amber-500' : 'text-muted-foreground',
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
