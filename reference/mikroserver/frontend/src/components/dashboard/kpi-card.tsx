'use client';

import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, TrendingUp } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: { value: number; label: string; alert?: boolean };
  variant?: 'primary' | 'success' | 'warning' | 'danger';
}

const cfg = {
  primary: { gradient: 'from-primary/10', icon: 'bg-primary/15 text-primary', ring: 'ring-primary/20' },
  success: { gradient: 'from-emerald-500/10', icon: 'bg-emerald-500/15 text-emerald-400', ring: 'ring-emerald-500/20' },
  warning: { gradient: 'from-amber-500/10', icon: 'bg-amber-500/15 text-amber-400', ring: 'ring-amber-500/20' },
  danger:  { gradient: 'from-red-500/10', icon: 'bg-red-500/15 text-red-400', ring: 'ring-red-500/20' },
};

export function KpiCard({ title, value, icon, trend, variant = 'primary' }: KpiCardProps) {
  const c = cfg[variant];
  return (
    <div className="rounded-xl border bg-card p-5 relative overflow-hidden hover:shadow-lg transition-shadow">
      <div className={clsx('absolute inset-0 bg-gradient-to-br to-transparent pointer-events-none', c.gradient)} />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className={clsx('p-2 rounded-xl', c.icon)}>
            {icon}
          </div>
        </div>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {trend && (
          <div className="mt-2 flex items-center gap-1.5">
            {trend.alert
              ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              : <TrendingUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            }
            <span className={clsx('text-xs', trend.alert ? 'text-amber-500' : 'text-muted-foreground')}>
              {trend.value} {trend.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
