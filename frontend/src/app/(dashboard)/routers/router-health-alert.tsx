import { AlertTriangle } from 'lucide-react';

interface Props {
  failures: number;
  lastError?: string | null;
}

export function RouterHealthAlert({ failures, lastError }: Props) {
  if (failures === 0) return null;
  return (
    <div
      className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-[11px] text-warning"
      title={lastError ?? undefined}
    >
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
      <span>
        {failures} échec{failures > 1 ? 's' : ''} health-check
        {lastError && (
          <span className="ml-1 opacity-75 truncate block max-w-[180px]">{lastError}</span>
        )}
      </span>
    </div>
  );
}
