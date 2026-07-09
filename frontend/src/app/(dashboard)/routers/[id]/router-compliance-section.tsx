'use client';

import { ComplianceScoreRing } from '@/components/ui/compliance-score-ring';
import type { HotspotComplianceSummary } from './router-detail.selectors';
import type { HotspotUserRow, RouterComplianceCheck, RouterDetail } from './router-detail.types';
import { ComplianceActionBanner } from './compliance-action-banner';
import { HotspotUserComplianceTable } from './hotspot-user-compliance-table';
import { RouterConfigChecklist } from './router-config-checklist';

interface RouterComplianceSectionProps {
  routerInfo: RouterDetail;
  configChecks: RouterComplianceCheck[];
  complianceSummary: HotspotComplianceSummary;
  hotspotUsers: HotspotUserRow[];
  isUsersLoading: boolean;
  usersErrorMessage: string | null;
  canManage: boolean;
  isDisconnectPending: boolean;
  onAction: (actionId: NonNullable<RouterComplianceCheck['actionId']>) => void;
  onDisconnectExpired: () => void;
  onChangeProfile: (user: HotspotUserRow) => void;
  onRetryUsers?: () => void;
}

function buildScore(checks: RouterComplianceCheck[]): {
  score: number;
  criticals: number;
  warnings: number;
} {
  if (checks.length === 0) return { score: 100, criticals: 0, warnings: 0 };
  const criticals = checks.filter((c) => c.severity === 'critical').length;
  const warnings = checks.filter((c) => c.severity === 'warning').length;
  const score = Math.round(((checks.length - criticals) / checks.length) * 100);
  return { score, criticals, warnings };
}

export function RouterComplianceSection({
  routerInfo,
  configChecks,
  complianceSummary,
  hotspotUsers,
  isUsersLoading,
  usersErrorMessage,
  canManage,
  isDisconnectPending,
  onAction,
  onDisconnectExpired,
  onChangeProfile,
  onRetryUsers,
}: RouterComplianceSectionProps) {
  const { score, criticals, warnings } = buildScore(configChecks);

  return (
    <section
      id="section-panel-conformite"
      aria-labelledby="compliance-heading"
      className="rounded-xl border bg-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-4 border-b px-5 py-4">
        <ComplianceScoreRing score={score} criticals={criticals} warnings={warnings} size={56} />
        <div className="min-w-0">
          <h2 id="compliance-heading" className="font-semibold">
            Conformité hotspot — {routerInfo.name}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {criticals === 0 && warnings === 0
              ? 'Toutes les vérifications sont conformes.'
              : `${criticals > 0 ? `${criticals} critique${criticals > 1 ? 's' : ''}` : ''}${criticals > 0 && warnings > 0 ? ' · ' : ''}${warnings > 0 ? `${warnings} avertissement${warnings > 1 ? 's' : ''}` : ''}`}
          </p>
        </div>
      </div>

      <div className="divide-y divide-border">
        {/* Action banner — expired sessions */}
        {complianceSummary.expiredButActive.length > 0 && (
          <div className="px-5 py-4">
            <ComplianceActionBanner
              summary={complianceSummary}
              canAct={canManage}
              isDisconnectPending={isDisconnectPending}
              onDisconnectExpired={onDisconnectExpired}
            />
          </div>
        )}

        {/* Config checklist */}
        <div className="px-5 py-4">
          <RouterConfigChecklist
            checks={configChecks}
            isLoading={false}
            canManage={canManage}
            onAction={onAction}
          />
        </div>

        {/* Sessions table */}
        <section aria-labelledby="compliance-sessions-heading">
          <div className="border-b px-5 py-3">
            <h3
              id="compliance-sessions-heading"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Utilisateurs hotspot
            </h3>
          </div>
          <HotspotUserComplianceTable
            users={hotspotUsers}
            isLoading={isUsersLoading}
            errorMessage={usersErrorMessage}
            canManage={canManage}
            onChangeProfile={onChangeProfile}
            onRetry={onRetryUsers}
          />
        </section>
      </div>
    </section>
  );
}
