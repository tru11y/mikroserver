import { AlertTriangle } from 'lucide-react';

export function AuditWarningBanner() {
  return (
    <aside
      className="rounded-xl border border-warning/20 bg-warning/10 p-4 text-sm text-warning"
      role="note"
      aria-label="Journal en lecture seule"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>
          Journal d&apos;audit en lecture seule — toutes les entrées sont définitives et ne peuvent être ni
          modifiées ni supprimées. Page réservée aux administrateurs{' '}
          <span className="font-semibold">SUPER_ADMIN</span>.
        </p>
      </div>
    </aside>
  );
}
