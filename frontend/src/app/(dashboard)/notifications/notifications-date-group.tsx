import type { Notification } from '@/lib/api/notifications';
import { NotificationsItem } from './notifications-item';

interface NotificationsDateGroupProps {
  label: string;
  items: Notification[];
  onMarkRead: (id: string) => void;
}

export function NotificationsDateGroup({ label, items, onMarkRead }: NotificationsDateGroupProps) {
  const headingId = `notif-group-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <section aria-labelledby={headingId}>
      <div className="px-4 py-2 bg-muted/30 border-b border-border/40">
        <p
          id={headingId}
          className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </p>
      </div>
      <ul role="list" className="divide-y divide-border/40">
        {items.map((notif) => (
          <NotificationsItem key={notif.id} notification={notif} onMarkRead={onMarkRead} />
        ))}
      </ul>
    </section>
  );
}
