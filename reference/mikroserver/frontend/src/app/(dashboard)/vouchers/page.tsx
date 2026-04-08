'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Ticket, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, Trash2, RefreshCw, Download } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Voucher {
  id: string;
  code: string;
  status: 'GENERATED' | 'DELIVERED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DELIVERY_FAILED';
  planName?: string;
  generationType?: 'AUTO' | 'MANUAL';
  routerName?: string | null;
  lastDeliveryError?: string | null;
  deliveryAttempts?: number;
  expiresAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

const STATUS_CFG = {
  GENERATED: { label: 'Généré', icon: Clock,       color: 'text-slate-400',   bg: 'bg-slate-400/10 border-slate-400/20' },
  DELIVERED: { label: 'Livré',  icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  ACTIVE:    { label: 'Actif',  icon: CheckCircle, color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/20' },
  EXPIRED:   { label: 'Expiré', icon: Clock,       color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/20' },
  REVOKED:   { label: 'Révoqué',icon: XCircle,     color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/20' },
  DELIVERY_FAILED: { label: 'Échec livraison', icon: XCircle, color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
};

export default function VouchersPage() {
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vouchers', page],
    queryFn: () => api.vouchers.list(page, 20),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.vouchers.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vouchers'] }),
  });

  const redeliverMutation = useMutation({
    mutationFn: (id: string) => api.vouchers.redeliver(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vouchers'] }),
  });

  const result = (data as any)?.data?.data ?? {};
  const vouchers: Voucher[] = result.items ?? [];
  const total: number = result.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const selectedVouchers = vouchers.filter((voucher) => selectedIds.includes(voucher.id));

  const handleDownloadPdf = async () => {
    if (!selectedVouchers.length) return;
    const res = await api.vouchers.downloadPdf(selectedVouchers.map((voucher) => voucher.id));
    const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelected = (voucherId: string) => {
    setSelectedIds((current) =>
      current.includes(voucherId)
        ? current.filter((id) => id !== voucherId)
        : [...current, voucherId],
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vouchers</h1>
        <p className="text-muted-foreground text-sm mt-1">{total} voucher{total !== 1 ? 's' : ''} au total</p>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {selectedIds.length} ticket{selectedIds.length !== 1 ? 's' : ''} sélectionné{selectedIds.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={handleDownloadPdf}
          disabled={selectedIds.length === 0}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export PDF
        </button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="p-12 text-center">
            <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-medium">Aucun voucher</p>
            <p className="text-muted-foreground text-sm mt-1">Les vouchers générés lors des paiements apparaîtront ici</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {['', 'Code', 'Forfait', 'Routeur', 'Type', 'Expiration', 'Statut', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vouchers.map((v) => {
                  const cfg = STATUS_CFG[v.status] ?? STATUS_CFG.EXPIRED;
                  const Icon = cfg.icon;
                  return (
                    <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(v.id)}
                          onChange={() => toggleSelected(v.id)}
                          className="h-4 w-4 rounded border-border"
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-sm font-bold tracking-widest">{v.code}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs">{v.planName ?? '—'}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{v.routerName ?? '—'}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{v.generationType === 'MANUAL' ? 'Manuel' : 'Auto'}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {v.expiresAt
                          ? formatDistanceToNow(new Date(v.expiresAt), { addSuffix: true, locale: fr })
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={clsx('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium', cfg.bg, cfg.color)}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {['GENERATED', 'DELIVERY_FAILED'].includes(v.status) && (
                            <button
                              onClick={() => redeliverMutation.mutate(v.id)}
                              disabled={redeliverMutation.isPending}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs hover:bg-muted transition-colors disabled:opacity-50"
                              title={v.lastDeliveryError ?? 'Relancer la livraison vers le routeur'}
                            >
                              <RefreshCw className="h-3 w-3" />
                              Relivrer
                            </button>
                          )}
                          {['GENERATED', 'DELIVERED', 'ACTIVE', 'DELIVERY_FAILED'].includes(v.status) && (
                            <button
                              onClick={() => revokeMutation.mutate(v.id)}
                              disabled={revokeMutation.isPending}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Révoquer
                            </button>
                          )}
                        </div>
                        {v.lastDeliveryError && (
                          <p className="mt-1 text-[11px] text-orange-400 max-w-48 truncate" title={v.lastDeliveryError}>
                            {v.lastDeliveryError}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="px-5 py-3 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Page {page} / {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border hover:bg-muted transition-colors disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border hover:bg-muted transition-colors disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
