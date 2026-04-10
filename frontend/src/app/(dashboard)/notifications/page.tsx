'use client';

import { useState } from 'react';
import { Bell, CheckCircle, Wifi, AlertTriangle, CreditCard, Info, ShoppingBag, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, Notification } from '@/lib/api/notifications';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const TYPE_ICONS: Record<string, React.ReactNode> = {
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

const TYPE_LABELS: Record<string, string> = {
  NEW_CONNECTION: 'Nouvelle connexion',
  SESSION_EXPIRED: 'Session expirée',
  PAYMENT_RECEIVED: 'Paiement reçu',
  ROUTER_OFFLINE: 'Routeur hors ligne',
  ROUTER_ONLINE: 'Routeur en ligne',
  VOUCHER_EXPIRING: 'Ticket expirant',
  SUBSCRIPTION_EXPIRING: 'Abonnement expirant',
  SECURITY_ALERT: 'Alerte sécurité',
  SYSTEM: 'Système',
};

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page, unreadOnly],
    queryFn: async () => {
      const res = await notificationsApi.findAll({ page, limit: 25, unreadOnly });
      return (res.data as unknown as { data: { items: Notification[]; total: number; unreadCount: number } }).data;
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notifications
          </h1>
          {(data?.unreadCount ?? 0) > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {data!.unreadCount} non lue{data!.unreadCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUnreadOnly((v) => !v)}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${unreadOnly ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
          >
            Non lues seulement
          </button>
          {(data?.unreadCount ?? 0) > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-sm px-3 py-1.5 rounded-lg border hover:bg-muted flex items-center gap-1"
            >
              <Check className="h-3.5 w-3.5" /> Tout marquer lu
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden divide-y">
        {isLoading && (
          <div className="py-12 text-center text-muted-foreground text-sm">Chargement...</div>
        )}
        {!isLoading && (!data?.items?.length) && (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Aucune notification{unreadOnly ? ' non lue' : ''}
          </div>
        )}
        {data?.items?.map((notif) => (
          <div
            key={notif.id}
            onClick={() => !notif.isRead && markRead.mutate(notif.id)}
            className={`flex gap-4 px-6 py-4 cursor-pointer hover:bg-muted/30 transition-colors ${!notif.isRead ? 'bg-primary/5' : ''}`}
          >
            <div className="mt-0.5 h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              {TYPE_ICONS[notif.type] ?? <Info className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-sm font-medium ${!notif.isRead ? '' : 'text-muted-foreground'}`}>
                    {notif.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{notif.body}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })}
                  </p>
                  {!notif.isRead && (
                    <span className="inline-block mt-1 h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
              </div>
              <div className="mt-1">
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {TYPE_LABELS[notif.type] ?? notif.type}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted"
          >
            Précédent
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
