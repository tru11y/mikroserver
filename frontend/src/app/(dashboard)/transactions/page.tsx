'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { CreditCard, ChevronLeft, ChevronRight, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Transaction {
  id: string;
  reference: string;
  amountXof: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  externalReference?: string;
  customerPhone?: string;
  customerName?: string;
  plan?: { name: string };
  createdAt: string;
}

const STATUS_CFG = {
  PENDING:   { label: 'En attente', icon: Clock,        color: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/20' },
  COMPLETED: { label: 'Complété',   icon: CheckCircle,  color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  FAILED:    { label: 'Échoué',     icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20' },
  REFUNDED:  { label: 'Remboursé',  icon: CreditCard,   color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/20' },
};

export default function TransactionsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page],
    queryFn: () => api.transactions.list(page, 20),
  });

  const result = (data ? unwrap<{ data?: Transaction[]; total?: number }>(data) : null) ?? {};
  const transactions: Transaction[] = result.data ?? [];
  const total: number = result.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm mt-1">{total} transaction{total !== 1 ? 's' : ''} au total</p>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-medium">Aucune transaction</p>
            <p className="text-muted-foreground text-sm mt-1">Les transactions apparaîtront ici</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {['Date', 'Client', 'Forfait', 'Montant', 'Statut', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => {
                  const cfg = STATUS_CFG[tx.status] ?? STATUS_CFG.PENDING;
                  const Icon = cfg.icon;
                  return (
                    <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true, locale: fr })}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-xs">{tx.customerPhone ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{tx.customerName ?? ''}</p>
                      </td>
                      <td className="px-5 py-3.5 text-xs">{tx.plan?.name ?? '—'}</td>
                      <td className="px-5 py-3.5 font-semibold tabular-nums">
                        {(tx.amountXof ?? 0).toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={clsx('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium', cfg.bg, cfg.color)}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {tx.externalReference && (
                          <span className="font-mono text-xs text-muted-foreground">{tx.externalReference.slice(0, 12)}…</span>
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
