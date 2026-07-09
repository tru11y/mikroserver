'use client';

import { Calendar, Wifi } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CustomerActivitySectionProps {
  firstSeenAt: string;
  lastSeenAt: string;
  lastUsername: string | null;
}

export function CustomerActivitySection({
  firstSeenAt,
  lastSeenAt,
  lastUsername,
}: CustomerActivitySectionProps) {
  return (
    <section
      aria-labelledby="customer-activity-heading"
      className="bg-card border rounded-xl p-5 space-y-3"
    >
      <h2
        id="customer-activity-heading"
        className="font-semibold text-sm text-muted-foreground uppercase tracking-wide"
      >
        Activité
      </h2>
      <ul className="space-y-2.5" role="list">
        <li className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          <div>
            <span className="font-medium">Première connexion</span>
            <span className="text-muted-foreground ml-2">
              {format(new Date(firstSeenAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </span>
          </div>
        </li>
        <li className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
          <div>
            <span className="font-medium">Dernière activité</span>
            <span className="text-muted-foreground ml-2">
              {formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true, locale: fr })}
            </span>
          </div>
        </li>
        {lastUsername && (
          <li className="flex items-center gap-3 text-sm">
            <Wifi className="h-4 w-4 text-info shrink-0" aria-hidden="true" />
            <div>
              <span className="font-medium">Dernier identifiant</span>
              <span className="font-mono text-muted-foreground ml-2">{lastUsername}</span>
            </div>
          </li>
        )}
      </ul>
    </section>
  );
}
