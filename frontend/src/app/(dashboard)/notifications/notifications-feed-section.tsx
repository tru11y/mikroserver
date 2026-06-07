'use client';

import { Bell, Loader2 } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { NotificationsDateGroup } from './notifications-date-group';
import { NotificationsSkeletonRow } from './notifications-skeleton-row';
import type { DateGroup } from './use-notifications-page';

interface NotificationsFeedSectionProps {
  groups: DateGroup[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  unreadOnly: boolean;
  hasMore: boolean;
  onMarkRead: (id: string) => void;
  onLoadMore: () => void;
  onRetry: () => void;
}

export function NotificationsFeedSection({
  groups,
  isLoading,
  isFetching,
  isError,
  unreadOnly,
  hasMore,
  onMarkRead,
  onLoadMore,
  onRetry,
}: NotificationsFeedSectionProps) {
  const isEmpty = !isLoading && !isError && groups.length === 0;

  return (
    <section aria-labelledby="notifications-feed-heading" className="rounded-xl border bg-card overflow-hidden">
      <h2 id="notifications-feed-heading" className="sr-only">
        Liste des notifications
      </h2>

      {isLoading && (
        <div
          aria-busy="true"
          aria-label="Chargement des notifications"
          className="divide-y divide-border/40"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <NotificationsSkeletonRow key={i} />
          ))}
        </div>
      )}

      {isError && (
        <div className="p-6">
          <ErrorState
            title="Impossible de charger les notifications"
            message="Une erreur est survenue. Vérifiez votre connexion."
            onRetry={onRetry}
            variant="inline"
          />
        </div>
      )}

      {isEmpty && (
        <div className="p-6">
          <EmptyState
            icon={<Bell className="h-5 w-5" />}
            title={unreadOnly ? 'Aucune notification non lue' : 'Aucune notification'}
            description={
              unreadOnly
                ? 'Toutes vos notifications ont été lues.'
                : 'Vous recevrez ici les alertes réseau, paiements et événements système.'
            }
          />
        </div>
      )}

      {!isLoading && !isError && groups.length > 0 && (
        <>
          <div className="divide-y divide-border/40">
            {groups.map((group) => (
              <NotificationsDateGroup
                key={group.label}
                label={group.label}
                items={group.items}
                onMarkRead={onMarkRead}
              />
            ))}
          </div>

          {hasMore && (
            <div className="border-t border-border/40 p-4">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isFetching}
                className={[
                  'inline-flex w-full items-center justify-center gap-2',
                  'rounded-lg border px-4 py-2 text-sm text-muted-foreground',
                  'transition-all duration-200 ease-out active:scale-[0.98]',
                  'hover:bg-muted hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                  'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                ].join(' ')}
              >
                {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {isFetching ? 'Chargement…' : 'Voir plus'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
