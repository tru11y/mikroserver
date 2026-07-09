'use client';

import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { ComplianceCheckBadge } from '@/components/ui/compliance-check-badge';
import type { RouterComplianceCheck } from './router-detail.types';

const ICONS = {
  ok: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
} as const;

const ICON_CLASSES: Record<RouterComplianceCheck['severity'], string> = {
  ok: 'text-success',
  warning: 'text-warning',
  critical: 'text-destructive',
};

interface ComplianceCheckItemProps {
  check: RouterComplianceCheck;
  canAct: boolean;
  onAction?: (actionId: NonNullable<RouterComplianceCheck['actionId']>) => void;
}

export function ComplianceCheckItem({ check, canAct, onAction }: ComplianceCheckItemProps) {
  const Icon = ICONS[check.severity];

  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon
        className={clsx('mt-0.5 h-4 w-4 shrink-0', ICON_CLASSES[check.severity])}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{check.label}</span>
          <ComplianceCheckBadge status={check.severity} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{check.description}</p>
      </div>
      {canAct && check.actionId && check.severity !== 'ok' && onAction && (
        <button
          type="button"
          onClick={() => onAction(check.actionId!)}
          className="shrink-0 rounded-lg border px-2.5 py-1 text-xs transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {check.actionLabel}
        </button>
      )}
    </li>
  );
}
