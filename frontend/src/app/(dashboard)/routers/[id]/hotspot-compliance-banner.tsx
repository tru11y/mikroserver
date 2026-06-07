import { clsx } from 'clsx';
import type { HotspotComplianceSummary } from './router-detail.selectors';

interface HotspotComplianceBannerProps {
  isLoading: boolean;
  summary: HotspotComplianceSummary;
}

export function HotspotComplianceBanner({
  isLoading,
  summary,
}: HotspotComplianceBannerProps) {
  if (isLoading) {
    return null;
  }

  return (
    <div
      className={clsx(
        'mx-5 mt-4 rounded-lg border px-3 py-3 text-sm',
        summary.expiredButActive.length > 0
          ? 'border-destructive/30 bg-destructive/10'
          : summary.expiringSoon.length > 0
            ? 'border-warning/30 bg-warning/10'
            : 'border-success/30 bg-success/10',
      )}
    >
      <p className="font-semibold">Analyse de conformité</p>
      <p className="mt-1 text-xs text-muted-foreground">{summary.recommendation}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border px-2 py-0.5">Gérés : {summary.managed}</span>
        <span className="rounded-full border px-2 py-0.5">Non gérés : {summary.unmanaged}</span>
        <span className="rounded-full border border-destructive/30 px-2 py-0.5 text-destructive">
          Expiré + actif : {summary.expiredButActive.length}
        </span>
        <span className="rounded-full border border-warning/30 px-2 py-0.5 text-warning">
          Expiré (inactif) : {summary.expiredInactive.length}
        </span>
        <span className="rounded-full border border-warning/30 px-2 py-0.5 text-warning">
          Expire bientôt (&lt;30 min) : {summary.expiringSoon.length}
        </span>
      </div>
    </div>
  );
}
