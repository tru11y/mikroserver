import { clsx } from 'clsx';
import { Archive, CheckCircle2 } from 'lucide-react';

interface PlanStatusBadgeProps {
  status: 'ACTIVE' | 'ARCHIVED';
  className?: string;
}

export function PlanStatusBadge({ status, className }: PlanStatusBadgeProps) {
  const isActive = status === 'ACTIVE';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        isActive
          ? 'border-[hsl(var(--success)/0.2)] bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]'
          : 'border-border bg-muted/60 text-muted-foreground',
        className,
      )}
    >
      {isActive ? (
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--success))] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
        </span>
      ) : (
        <Archive className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
      )}
      {isActive ? 'Actif' : 'Archivé'}
    </span>
  );
}
