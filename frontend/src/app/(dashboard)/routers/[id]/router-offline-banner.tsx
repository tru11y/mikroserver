import { AlertTriangle } from 'lucide-react';
import { formatRelative } from './router-detail.utils';

interface RouterOfflineBannerProps {
  status: string;
  lastHealthCheckAt?: string;
  lastHealthCheckError?: string | null;
}

export function RouterOfflineBanner({
  status,
  lastHealthCheckAt,
  lastHealthCheckError,
}: RouterOfflineBannerProps) {
  const isOffline = status === 'OFFLINE';

  return (
    <div
      role="alert"
      className={`rounded-xl border p-4 text-sm ${
        isOffline
          ? 'border-destructive/30 bg-destructive/10'
          : 'border-warning/30 bg-warning/10'
      }`}
    >
      <div
        className={`flex items-start gap-2 ${
          isOffline ? 'text-destructive' : 'text-warning'
        }`}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium">
            {isOffline
              ? 'Routeur hors ligne — toutes les sections sont en mode dégradé'
              : 'Routeur dégradé — certaines fonctionnalités peuvent être indisponibles'}
          </p>
          {lastHealthCheckAt && (
            <p className="text-xs opacity-80">
              Dernier contact {formatRelative(lastHealthCheckAt)}
            </p>
          )}
          {lastHealthCheckError && (
            <p className="font-mono text-xs opacity-80">{lastHealthCheckError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
