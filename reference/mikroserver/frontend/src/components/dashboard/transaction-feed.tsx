'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

interface Transaction {
  id: string;
  reference: string;
  customerPhone: string;
  amountXof: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  createdAt: string;
  paidAt: string | null;
  plan: { name: string; slug: string } | null;
}

const statusConfig = {
  COMPLETED: { label: 'Réussi', icon: CheckCircle2, class: 'text-emerald-500' },
  FAILED: { label: 'Échoué', icon: XCircle, class: 'text-red-500' },
  EXPIRED: { label: 'Expiré', icon: XCircle, class: 'text-slate-400' },
  PENDING: { label: 'En attente', icon: Clock, class: 'text-amber-500' },
  PROCESSING: { label: 'Traitement', icon: Loader2, class: 'text-blue-500 animate-spin' },
};

function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-2);
}

export function TransactionFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', 'feed'],
    queryFn: () => api.transactions.list(1, 20),
    refetchInterval: 15_000,
  });

  const transactions = (data?.data?.data?.data as Transaction[]) ?? [];

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-5 border-b">
        <h3 className="font-semibold">Transactions récentes</h3>
        <p className="text-sm text-muted-foreground">
          Dernières 20 transactions · Actualisation auto
        </p>
      </div>

      {isLoading ? (
        <div className="p-5 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {transactions.map((tx) => {
            const cfg = statusConfig[tx.status] ?? statusConfig.PENDING;
            const StatusIcon = cfg.icon;

            return (
              <div
                key={tx.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors"
              >
                <StatusIcon className={clsx('h-4 w-4 flex-shrink-0', cfg.class)} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {maskPhone(tx.customerPhone)}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      · {tx.plan?.name ?? 'Plan inconnu'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {tx.reference}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold">
                    {tx.amountXof.toLocaleString('fr-CI')} FCFA
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(tx.createdAt), 'dd/MM HH:mm', {
                      locale: fr,
                    })}
                  </p>
                </div>

                <div className="w-20 text-right">
                  <span className={clsx('text-xs font-medium', cfg.class)}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}

          {transactions.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Aucune transaction
            </div>
          )}
        </div>
      )}
    </div>
  );
}
