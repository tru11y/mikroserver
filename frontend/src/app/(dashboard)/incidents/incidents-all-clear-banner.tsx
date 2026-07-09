'use client';

import { ShieldCheck } from 'lucide-react';
import { IncidentTimestamp } from './incident-timestamp';

interface IncidentsAllClearBannerProps {
  generatedAt?: string;
}

export function IncidentsAllClearBanner({ generatedAt }: IncidentsAllClearBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-success/30 bg-success/10 p-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15">
          <ShieldCheck className="h-5 w-5 text-success" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-success">Aucun incident ouvert</p>
          <p className="mt-0.5 text-sm text-success/80">
            La supervision ne remonte ni routeur hors ligne, ni échec de synchronisation, ni backlog significatif.
          </p>
        </div>
      </div>
      {generatedAt && (
        <p className="mt-4 text-xs text-success/60">
          Vérifié <IncidentTimestamp iso={generatedAt} />
        </p>
      )}
    </div>
  );
}
