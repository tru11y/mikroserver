import { clsx } from 'clsx';
import type { IncidentSeverity } from './incidents.types';

interface IncidentSeverityBadgeProps {
  severity: IncidentSeverity;
  className?: string;
}

const SEVERITY_CLASSES: Record<IncidentSeverity, string> = {
  CRITICAL: 'border-destructive/40 bg-destructive/10 text-destructive',
  HIGH:     'border-warning/40 bg-warning/10 text-warning',
  MEDIUM:   'border-warning/20 bg-warning/5 text-warning/80',
  LOW:      'border-border bg-muted/20 text-muted-foreground',
};

const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  CRITICAL: 'Critique',
  HIGH:     'Haute',
  MEDIUM:   'Moyenne',
  LOW:      'Faible',
};

export function IncidentSeverityBadge({ severity, className }: IncidentSeverityBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors duration-150',
        SEVERITY_CLASSES[severity],
        className,
      )}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

export { SEVERITY_CLASSES, SEVERITY_LABELS };
