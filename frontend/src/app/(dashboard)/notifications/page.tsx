'use client';

import { useNotificationsPage } from './use-notifications-page';
import { NotificationsHeroSection } from './notifications-hero-section';
import { NotificationsFilterBar } from './notifications-filter-bar';
import { NotificationsFeedSection } from './notifications-feed-section';

export default function NotificationsPage() {
  const {
    groups,
    unreadCount,
    hasMore,
    isLoading,
    isFetching,
    isError,
    unreadOnly,
    setUnreadOnly,
    onMarkRead,
    onMarkAllRead,
    isMarkingAllRead,
    onLoadMore,
    onRetry,
  } = useNotificationsPage();

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <NotificationsHeroSection unreadCount={unreadCount} isLoading={isLoading} />
      <NotificationsFilterBar
        unreadOnly={unreadOnly}
        onToggleUnreadOnly={() => setUnreadOnly((v) => !v)}
        hasUnread={unreadCount > 0}
        onMarkAllRead={onMarkAllRead}
        isMarkingAllRead={isMarkingAllRead}
      />
      <NotificationsFeedSection
        groups={groups}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        unreadOnly={unreadOnly}
        hasMore={hasMore}
        onMarkRead={onMarkRead}
        onLoadMore={onLoadMore}
        onRetry={onRetry}
      />
    </main>
  );
}
