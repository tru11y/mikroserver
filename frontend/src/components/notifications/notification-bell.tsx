'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getStoredAccessToken } from '@/lib/api/client';
import { Bell, Wifi, AlertTriangle, CheckCircle, CreditCard, Info, ShoppingBag, BellRing } from 'lucide-react';
import { notificationsApi, Notification } from '@/lib/api/notifications';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  NEW_CONNECTION: <Wifi className="h-4 w-4 text-green-500" />,
  SESSION_EXPIRED: <Wifi className="h-4 w-4 text-gray-400" />,
  PAYMENT_RECEIVED: <CreditCard className="h-4 w-4 text-blue-500" />,
  ROUTER_OFFLINE: <AlertTriangle className="h-4 w-4 text-red-500" />,
  ROUTER_ONLINE: <CheckCircle className="h-4 w-4 text-green-500" />,
  VOUCHER_EXPIRING: <ShoppingBag className="h-4 w-4 text-orange-500" />,
  SUBSCRIPTION_EXPIRING: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  SECURITY_ALERT: <AlertTriangle className="h-4 w-4 text-red-600" />,
  SYSTEM: <Info className="h-4 w-4 text-blue-400" />,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { permission, isSubscribed, isLoading: pushLoading, subscribe } = usePushNotifications();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationsApi.getUnreadCount();
      setUnreadCount((res.data as unknown as { data: { count: number } }).data.count);
    } catch { /* ignore */ }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.findAll({ limit: 15 });
      const data = (res.data as unknown as { data: { items: Notification[]; unreadCount: number } }).data;
      setNotifications(data.items);
      setUnreadCount(data.unreadCount);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // Poll unread count every 30s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // SSE connection
  useEffect(() => {
    const connectSSE = () => {
      const token = getStoredAccessToken();
      if (!token) return;

      const url = `${window.location.origin}/proxy/api/v1/notifications/stream`;
      const es = new EventSource(url, { withCredentials: false });
      // Note: EventSource doesn't support custom headers natively
      // In production, use a query param token or cookie-based auth
      eventSourceRef.current = es;

      es.addEventListener('notification', (event) => {
        try {
          const notif = JSON.parse((event as MessageEvent).data) as Notification;
          setNotifications((prev) => [notif, ...prev].slice(0, 15));
          setUnreadCount((c) => c + 1);
        } catch { /* ignore */ }
      });

      es.onerror = () => {
        es.close();
        // Reconnect after 5 seconds
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpen = () => {
    setOpen((prev) => !prev);
    if (!open) fetchNotifications();
  };

  const handleMarkRead = async (id: string) => {
    await notificationsApi.markRead(id).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-10 w-80 bg-card border rounded-xl shadow-2xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y">
            {loading && (
              <div className="py-8 text-center text-sm text-muted-foreground">Chargement...</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aucune notification
              </div>
            )}
            {!loading &&
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.isRead && handleMarkRead(notif.id)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !notif.isRead ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {NOTIFICATION_ICONS[notif.type] ?? <Info className="h-4 w-4 text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className={`text-xs font-medium leading-tight ${!notif.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="shrink-0 h-2 w-2 rounded-full bg-primary mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight line-clamp-2">
                      {notif.body}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notif.createdAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  </div>
                </div>
              ))}
          </div>

          {permission !== 'unsupported' && permission !== 'denied' && !isSubscribed && (
            <div className="px-4 py-3 border-t bg-primary/5">
              <button
                onClick={subscribe}
                disabled={pushLoading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                <BellRing className="h-3.5 w-3.5" />
                {pushLoading ? 'Activation...' : 'Activer les notifications push'}
              </button>
              <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                Soyez alerté à chaque nouvelle connexion WiFi
              </p>
            </div>
          )}

          <div className="px-4 py-2 border-t">
            <a
              href="/notifications"
              className="text-xs text-primary hover:underline block text-center"
            >
              Voir toutes les notifications →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
