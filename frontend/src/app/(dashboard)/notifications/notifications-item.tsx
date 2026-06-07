'use client';

import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Notification } from '@/lib/api/notifications';
import { NotificationsTypeAvatar, NotificationsTypeLabel } from './notifications-type-badge';

const CRITICAL_TYPES = new Set(['ROUTER_OFFLINE', 'SECURITY_ALERT']);

interface NotificationsItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
}

export function NotificationsItem({ notification, onMarkRead }: NotificationsItemProps) {
  const isCritical = CRITICAL_TYPES.has(notification.type);
  const isUnread = !notification.isRead;

  function handleClick() {
    if (isUnread) onMarkRead(notification.id);
  }

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className={clsx(
          'flex w-full gap-3 px-4 py-3 text-left',
          'transition-all duration-200 ease-out',
          'hover:bg-muted/30',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset',
          isCritical && 'border-l-2 border-destructive',
          isCritical && isUnread && 'bg-destructive/5',
          !isCritical && isUnread && 'bg-primary/5',
        )}
        aria-label={`${notification.title}${isUnread ? ' — non lu' : ''}`}
      >
        <NotificationsTypeAvatar type={notification.type} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <p
              className={clsx(
                'text-sm font-medium leading-snug',
                !isUnread && 'text-muted-foreground',
              )}
            >
              {notification.title}
            </p>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr })}
              </span>
              {isUnread && (
                <span
                  className="h-2 w-2 rounded-full bg-primary"
                  aria-label="Non lue"
                />
              )}
            </div>
          </div>

          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
            {notification.body}
          </p>

          <div className="mt-1.5">
            <NotificationsTypeLabel type={notification.type} />
          </div>
        </div>
      </button>
    </li>
  );
}
