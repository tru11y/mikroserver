'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Boxes, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { VouchersTabs } from '../vouchers-tabs';

interface BatchPlan {
  id: string;
  name: string;
  priceXof: number;
}

interface BatchRouter {
  id: string;
  name: string;
}

interface VoucherBatch {
  id: string;
  batchNumber: number;
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  quantity: number;
  generated: number;
  createdAt: string;
  completedAt: string | null;
  plan: BatchPlan;
  router: BatchRouter | null;
}

function StatusBadge({ status, generated, quantity }: { status: VoucherBatch['status']; generated: number; quantity: number }) {
  if (status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
        <CheckCircle2 className="h-3 w-3" />
        Terminé
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
        <XCircle className="h-3 w-3" />
        Échec
      </span>
    );
  }
  if (status === 'GENERATING') {
    const pct = quantity > 0 ? Math.round((generated / quantity) * 100) : 0;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
        <Loader2 className="h-3 w-3 animate-spin" />
        {pct}% ({generated}/{quantity})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      <Clock className="h-3 w-3" />
      En attente
    </span>
  );
}

export default function LotsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canView = hasPermission(currentUser, 'tickets.view');

  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ['voucher-batches', page],
    queryFn: () => api.vouchers.listBatches(page, 20),
    enabled: canView,
    // Auto-refetch if any batch is in progress
    refetchInterval: (query) => {
      const result = query.state.data
        ? unwrap<{ items?: VoucherBatch[] }>(query.state.data as never)
        : null;
      const hasInProgress = result?.items?.some(
        (b) => b.status === 'PENDING' || b.status === 'GENERATING',
      );
      return hasInProgress ? 3000 : false;
    },
  });

  const result = data ? unwrap<{ items?: VoucherBatch[]; total?: number }>(data) : null;
  const batches: VoucherBatch[] = result?.items ?? [];
  const total: number = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const handleSelectBatch = async (batch: VoucherBatch) => {
    if (batch.status !== 'COMPLETED') {
      toast.error('Lot non terminé — impossible de sélectionner les tickets');
      return;
    }
    try {
      const res = await api.vouchers.getBatchIds(batch.id);
      const ids = unwrap<string[]>(res) ?? [];
      if (!ids.length) { toast.error('Aucun ticket dans ce lot'); return; }
      // Navigate to vouchers list with batchId filter so the page loads the right tickets
      router.push(`/vouchers?batchId=${batch.id}&batchNumber=${batch.batchNumber}`);
    } catch {
      toast.error('Impossible de récupérer les tickets du lot');
    }
  };

  if (isMeLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <VouchersTabs permissions={{ canView, canCreate: hasPermission(currentUser, 'tickets.create'), canVerify: hasPermission(currentUser, 'tickets.verify') }} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Lots de tickets</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {total} lot{total > 1 ? 's' : ''} · chaque lot regroupe les tickets générés en une opération
          </p>
        </div>
        {isRefetching && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <section className="rounded-lg border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Boxes className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Aucun lot généré</p>
            <p className="text-xs text-muted-foreground">Générez vos premiers tickets pour les voir apparaître ici.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">N° lot</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Date</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Forfait</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Routeur</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Qté</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Statut</th>
                    <th className="px-3 py-2 w-32"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-3 py-2.5">
                        <span className="tabular-nums font-mono text-xs font-semibold text-primary">#{batch.batchNumber}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs">{new Date(batch.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(batch.createdAt), { addSuffix: true, locale: fr })}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium">{batch.plan.name}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{batch.plan.priceXof.toLocaleString('fr-FR')} FCFA</p>
                      </td>
                      <td className="hidden px-3 py-2.5 md:table-cell">
                        <p className="text-xs text-muted-foreground">{batch.router?.name ?? '—'}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="tabular-nums text-xs font-semibold">{batch.quantity}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={batch.status} generated={batch.generated} quantity={batch.quantity} />
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => void handleSelectBatch(batch)}
                          disabled={batch.status !== 'COMPLETED'}
                          className="rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                        >
                          Sélectionner
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav className="flex items-center justify-between border-t px-4 py-2.5" aria-label="Pagination des lots">
                <span className="tabular-nums text-xs text-muted-foreground">
                  Page {page} / {totalPages} · {total} total
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-md border p-1.5 transition-all hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-md border p-1.5 transition-all hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}
