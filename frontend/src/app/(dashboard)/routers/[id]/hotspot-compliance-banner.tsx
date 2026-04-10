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
          ? 'border-red-400/30 bg-red-500/10'
          : summary.expiringSoon.length > 0
            ? 'border-amber-400/30 bg-amber-500/10'
            : 'border-emerald-400/30 bg-emerald-500/10',
      )}
    >
      <p className="font-semibold">Controle IA des forfaits</p>
      <p className="mt-1 text-xs text-muted-foreground">{summary.recommendation}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border px-2 py-0.5">Geres: {summary.managed}</span>
        <span className="rounded-full border px-2 py-0.5">Non geres: {summary.unmanaged}</span>
        <span className="rounded-full border px-2 py-0.5 text-red-300 border-red-400/30">
          Expire + actif: {summary.expiredButActive.length}
        </span>
        <span className="rounded-full border px-2 py-0.5 text-amber-300 border-amber-400/30">
          Expire (inactif): {summary.expiredInactive.length}
        </span>
        <span className="rounded-full border px-2 py-0.5 text-amber-300 border-amber-400/30">
          Expire bientot (&lt;30min): {summary.expiringSoon.length}
        </span>
      </div>
    </div>
  );
}
