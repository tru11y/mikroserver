import { Ticket, Users } from 'lucide-react';
import type { PlanTicketSettings } from './plans.types';

interface PlanTicketBlockProps {
  settings: PlanTicketSettings;
  userProfile?: string | null;
  dataLimitMb?: number | null;
  formatDataLimit: (mb?: number | null) => string;
}

export function PlanTicketBlock({
  settings,
  userProfile,
  dataLimitMb,
  formatDataLimit,
}: PlanTicketBlockProps) {
  const ticketTypeLabel = settings.ticketType === 'PIN' ? 'PIN' : 'User / Mot de passe';
  const durationModeLabel = settings.durationMode === 'PAUSED' ? 'Temps pausé' : 'Temps écoulé';

  return (
    <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
        Ticketing
      </p>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Ticket className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          <span className="font-medium text-foreground">{ticketTypeLabel}</span>
        </span>
        <span aria-hidden="true">·</span>
        <span>{durationModeLabel}</span>
        {settings.ticketPrefix && (
          <>
            <span aria-hidden="true">·</span>
            <span>Préfixe <span className="font-mono text-foreground">{settings.ticketPrefix}</span></span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span>{settings.ticketCodeLength} car.</span>
        {settings.ticketNumericOnly && (
          <>
            <span aria-hidden="true">·</span>
            <span>Numérique</span>
          </>
        )}
        {settings.usersPerTicket > 1 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              {settings.usersPerTicket} utilisateurs
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground border-t border-border/40 pt-2 mt-1">
        <span>Profil : <span className="font-mono text-foreground">{userProfile ?? 'default'}</span></span>
        <span aria-hidden="true">·</span>
        <span>Quota : <span className="text-foreground">{formatDataLimit(dataLimitMb)}</span></span>
      </div>
    </div>
  );
}
