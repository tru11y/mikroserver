import { Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface NotificationsHeroSectionProps {
  unreadCount: number;
  isLoading: boolean;
}

export function NotificationsHeroSection({ unreadCount, isLoading }: NotificationsHeroSectionProps) {
  return (
    <header>
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        {isLoading && <Skeleton className="h-5 w-6 rounded-full" />}
        {!isLoading && unreadCount > 0 && (
          <span
            className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"
            aria-label={`${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`}
          >
            {unreadCount}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Événements réseau, paiements et alertes système
      </p>
    </header>
  );
}
