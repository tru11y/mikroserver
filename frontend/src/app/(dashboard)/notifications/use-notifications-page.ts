'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isToday, isThisWeek } from 'date-fns';
import { toast } from 'sonner';
import { notificationsApi, type Notification, type NotificationType } from '@/lib/api/notifications';

const PRIORITY_TYPES: NotificationType[] = ['ROUTER_OFFLINE', 'SECURITY_ALERT'];
const PAGE_SIZE = 25;

export interface DateGroup {
  label: string;
  items: Notification[];
}

interface RawData {
  items: Notification[];
  total: number;
  unreadCount: number;
}

function sortByPriority(items: Notification[]): Notification[] {
  return [...items].sort((a, b) => {
    const ap = PRIORITY_TYPES.includes(a.type) ? 0 : 1;
    const bp = PRIORITY_TYPES.includes(b.type) ? 0 : 1;
    return ap - bp;
  });
}

function groupByDate(items: Notification[]): DateGroup[] {
  const today: Notification[] = [];
  const week: Notification[] = [];
  const older: Notification[] = [];

  for (const notif of items) {
    const d = new Date(notif.createdAt);
    if (isToday(d)) {
      today.push(notif);
    } else if (isThisWeek(d, { weekStartsOn: 1 })) {
      week.push(notif);
    } else {
      older.push(notif);
    }
  }

  const groups: DateGroup[] = [];
  if (today.length) groups.push({ label: "Aujourd'hui", items: sortByPriority(today) });
  if (week.length)  groups.push({ label: 'Cette semaine', items: sortByPriority(week) });
  if (older.length) groups.push({ label: 'Plus ancien', items: older });
  return groups;
}

export function useNotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', limit, unreadOnly],
    queryFn: async () => {
      const res = await notificationsApi.findAll({ page: 1, limit, unreadOnly });
      return (res.data as unknown as { data: RawData }).data;
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: () => toast.error('Impossible de marquer la notification comme lue.'),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Toutes les notifications ont été marquées comme lues.');
    },
    onError: () => toast.error('Impossible de marquer toutes les notifications comme lues.'),
  });

  const groups = query.data ? groupByDate(query.data.items) : [];
  const totalLoaded = query.data?.items.length ?? 0;
  const total = query.data?.total ?? 0;

  return {
    groups,
    unreadCount:      query.data?.unreadCount ?? 0,
    hasMore:          totalLoaded < total,
    isLoading:        query.isLoading,
    isFetching:       query.isFetching,
    isError:          query.isError,
    unreadOnly,
    setUnreadOnly,
    onMarkRead:       (id: string) => markRead.mutate(id),
    onMarkAllRead:    () => markAllRead.mutate(),
    isMarkingAllRead: markAllRead.isPending,
    onLoadMore:       () => setLimit((prev) => prev + PAGE_SIZE),
    onRetry:          () => query.refetch(),
  };
}
