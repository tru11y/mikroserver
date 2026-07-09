import { clsx } from 'clsx';

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

const priorityCfg: Record<Priority, { label: string; cls: string }> = {
  HIGH:   { label: 'Haute',   cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  MEDIUM: { label: 'Moyenne', cls: 'bg-warning/10 text-warning border-warning/20' },
  LOW:    { label: 'Basse',   cls: 'bg-muted text-muted-foreground border-border' },
};

const severityCfg: Record<Severity, { cls: string }> = {
  CRITICAL: { cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  HIGH:     { cls: 'bg-warning/10 text-warning border-warning/20' },
  MEDIUM:   { cls: 'bg-warning/8 text-warning border-warning/15' },
  LOW:      { cls: 'bg-muted text-muted-foreground border-border' },
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const cfg = priorityCfg[priority];
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
        cfg.cls,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const cfg = severityCfg[severity];
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        cfg.cls,
        className,
      )}
    >
      {severity}
    </span>
  );
}
