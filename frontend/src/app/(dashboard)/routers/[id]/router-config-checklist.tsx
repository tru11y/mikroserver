'use client';

import { Settings2, ShieldCheck, WifiIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { RouterComplianceCheck } from './router-detail.types';
import { ComplianceCheckItem } from './compliance-check-item';

const CATEGORY_META: Record<
  RouterComplianceCheck['category'],
  { label: string; icon: typeof WifiIcon }
> = {
  connectivity: { label: 'Connectivité', icon: WifiIcon },
  configuration: { label: 'Configuration', icon: Settings2 },
  sessions: { label: 'Sessions', icon: ShieldCheck },
};

const CATEGORY_ORDER: RouterComplianceCheck['category'][] = [
  'connectivity',
  'configuration',
  'sessions',
];

interface RouterConfigChecklistProps {
  checks: RouterComplianceCheck[];
  isLoading: boolean;
  canManage: boolean;
  onAction: (actionId: NonNullable<RouterComplianceCheck['actionId']>) => void;
}

export function RouterConfigChecklist({
  checks,
  isLoading,
  canManage,
  onAction,
}: RouterConfigChecklistProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 px-1" role="status" aria-label="Chargement des vérifications en cours">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  const activeCategories = CATEGORY_ORDER.filter((cat) =>
    checks.some((c) => c.category === cat),
  );

  return (
    <div className="space-y-5">
      {activeCategories.map((cat) => {
        const { label, icon: Icon } = CATEGORY_META[cat];
        const catChecks = checks.filter((c) => c.category === cat);
        const catCriticals = catChecks.filter((c) => c.severity === 'critical').length;
        const catWarnings = catChecks.filter((c) => c.severity === 'warning').length;

        return (
          <section key={cat} aria-labelledby={`checklist-cat-${cat}`}>
            <div className="mb-1.5 flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <h3
                id={`checklist-cat-${cat}`}
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {label}
              </h3>
              {catCriticals > 0 && (
                <span className="rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                  {catCriticals} critique{catCriticals > 1 ? 's' : ''}
                </span>
              )}
              {catCriticals === 0 && catWarnings > 0 && (
                <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                  {catWarnings} avert.
                </span>
              )}
            </div>
            <ul className="divide-y divide-border/50" role="list">
              {catChecks.map((check) => (
                <ComplianceCheckItem
                  key={check.id}
                  check={check}
                  canAct={canManage}
                  onAction={onAction}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
