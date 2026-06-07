import { clsx } from 'clsx';

interface AuditEntityBadgeProps {
  entityType: string;
  className?: string;
}

export function AuditEntityBadge({ entityType, className }: AuditEntityBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md border border-border/50 bg-muted/20',
        'px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground',
        className,
      )}
    >
      {entityType}
    </span>
  );
}
