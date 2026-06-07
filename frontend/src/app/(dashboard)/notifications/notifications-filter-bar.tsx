'use client';

import { Check, Loader2, SlidersHorizontal } from 'lucide-react';
import { clsx } from 'clsx';

interface NotificationsFilterBarProps {
  unreadOnly: boolean;
  onToggleUnreadOnly: () => void;
  hasUnread: boolean;
  onMarkAllRead: () => void;
  isMarkingAllRead: boolean;
}

export function NotificationsFilterBar({
  unreadOnly,
  onToggleUnreadOnly,
  hasUnread,
  onMarkAllRead,
  isMarkingAllRead,
}: NotificationsFilterBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <button
          type="button"
          onClick={onToggleUnreadOnly}
          aria-pressed={unreadOnly}
          className={clsx(
            'rounded-lg px-3 py-1.5 text-sm font-medium',
            'transition-all duration-200 ease-out',
            'active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            unreadOnly
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          Non lues seulement
        </button>
      </div>

      {hasUnread && (
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={isMarkingAllRead}
          aria-disabled={isMarkingAllRead}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm',
            'text-muted-foreground transition-all duration-200 ease-out',
            'hover:bg-muted hover:text-foreground',
            'active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isMarkingAllRead ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isMarkingAllRead ? 'En cours…' : 'Tout marquer lu'}
        </button>
      )}
    </div>
  );
}
