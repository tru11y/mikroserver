import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface RouterKpiCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  icon: LucideIcon;
  gradientClass: string;
  iconBgClass: string;
  iconColorClass: string;
  valueColorClass?: string;
  valueSizeClass?: string;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function RouterKpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  gradientClass,
  iconBgClass,
  iconColorClass,
  valueColorClass,
  valueSizeClass = 'text-2xl',
  isLoading,
  children,
}: RouterKpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-5">
      <div className={clsx('absolute inset-0 bg-gradient-to-br to-transparent', gradientClass)} />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div className={clsx('rounded-lg p-1.5', iconBgClass)}>
            <Icon className={clsx('h-4 w-4', iconColorClass)} aria-hidden="true" />
          </div>
        </div>
        <p className={clsx('font-bold tabular-nums', valueSizeClass, valueColorClass)}>
          {isLoading ? (
            <span className="animate-pulse text-muted-foreground">—</span>
          ) : (
            value
          )}
        </p>
        {children && <div className="mt-2">{children}</div>}
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
