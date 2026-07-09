'use client';

import { Pencil } from 'lucide-react';
import { EnforcementBadge } from '@/components/ui/enforcement-badge';
import type { HotspotUserRow } from './router-detail.types';
import { formatElapsedFromMinutes } from './router-detail.utils';

interface HotspotUserCardMobileProps {
  user: HotspotUserRow;
  canManageHotspot: boolean;
  onChangeProfile: (user: HotspotUserRow) => void;
}

export function HotspotUserCardMobile({
  user,
  canManageHotspot,
  onChangeProfile,
}: HotspotUserCardMobileProps) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-medium">{user.username}</p>
          {user.comment && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.comment}</p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors duration-150 ${
              user.active
                ? 'border-success/30 text-success'
                : 'border-border text-muted-foreground'
            }`}
          >
            {user.active ? `Actif (${user.activeSessionCount})` : 'Inactif'}
          </span>
          {user.disabled && (
            <span className="rounded-full border border-destructive/30 px-2 py-0.5 text-[11px] text-destructive transition-colors duration-150">
              Désactivé
            </span>
          )}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <p className="text-muted-foreground">Profil</p>
          <p>{user.profile ?? '-'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Forfait</p>
          <p>{user.planName ?? '-'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Écoulé</p>
          <p>{formatElapsedFromMinutes(user.elapsedSinceFirstConnectionMinutes)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Conformité</p>
          <EnforcementBadge status={user.enforcementStatus} className="mt-0.5" />
        </div>
        {user.voucherExpiresAt && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Expiration</p>
            <p>
              {new Date(user.voucherExpiresAt).toLocaleString('fr-FR')}
              {user.remainingMinutes !== null && (
                <span className="ml-1 text-muted-foreground">
                  (
                  {user.remainingMinutes <= 0
                    ? `${Math.abs(user.remainingMinutes)} min dépassées`
                    : `${user.remainingMinutes} min restantes`}
                  )
                </span>
              )}
            </p>
          </div>
        )}
        {user.activeAddress && (
          <div>
            <p className="text-muted-foreground">IP active</p>
            <p className="font-mono text-[11px]">{user.activeAddress}</p>
          </div>
        )}
      </div>

      {canManageHotspot && (
        <div className="border-t border-border/50 pt-3">
          <button
            type="button"
            onClick={() => onChangeProfile(user)}
            aria-label={`Changer le profil de ${user.username}`}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Changer profil
          </button>
        </div>
      )}
    </div>
  );
}
