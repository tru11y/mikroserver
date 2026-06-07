import { clsx } from 'clsx';

export type ComplianceStatus = 'ok' | 'warning' | 'critical';

const CONFIG: Record<ComplianceStatus, { label: string; classes: string }> = {
  ok: {
    label: 'OK',
    classes: 'border-success/30 bg-success/10 text-success',
  },
  warning: {
    label: 'Avertissement',
    classes: 'border-warning/30 bg-warning/10 text-warning',
  },
  critical: {
    label: 'Critique',
    classes: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
};

interface ComplianceCheckBadgeProps {
  status: ComplianceStatus;
  label?: string;
}

export function ComplianceCheckBadge({ status, label }: ComplianceCheckBadgeProps) {
  const { label: defaultLabel, classes } = CONFIG[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors duration-150',
        classes,
      )}
    >
      {label ?? defaultLabel}
    </span>
  );
}
