'use client';

import { AlertTriangle, Loader2, UserX } from 'lucide-react';
import type { HotspotComplianceSummary } from './router-detail.selectors';

interface ComplianceActionBannerProps {
  summary: HotspotComplianceSummary;
  canAct: boolean;
  isDisconnectPending: boolean;
  onDisconnectExpired: () => void;
}

export function ComplianceActionBanner({
  summary,
  canAct,
  isDisconnectPending,
  onDisconnectExpired,
}: ComplianceActionBannerProps) {
  const { expiredButActive } = summary;
  if (expiredButActive.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-semibold text-destructive">
            {expiredButActive.length} client{expiredButActive.length > 1 ? 's' : ''} actif{expiredButActive.length > 1 ? 's' : ''} avec forfait expiré
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ces sessions ne devraient plus être actives. Vérifiez la politique d'éjection du routeur.
          </p>
        </div>
      </div>
      {canAct && (
        <button
          type="button"
          onClick={onDisconnectExpired}
          disabled={isDisconnectPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/20 px-3 py-1.5 text-xs font-medium text-destructive transition-all duration-200 ease-out hover:bg-destructive/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {isDisconnectPending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <UserX className="h-3 w-3" aria-hidden="true" />
          )}
          Déconnecter les expirés
        </button>
      )}
    </div>
  );
}
