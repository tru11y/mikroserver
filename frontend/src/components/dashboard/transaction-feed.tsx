'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { clsx } from 'clsx';
import { api, unwrap } from '@/lib/api';
import { getTransactionStatusCfg } from '@/lib/transaction-status';
import type { Transaction, TransactionListResponse } from '@/app/(dashboard)/transactions/transaction.types';

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return 'Vente manuelle';
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-2)}`;
}

export function TransactionFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', 'feed'],
    queryFn: () => api.transactions.list(1, 20),
    refetchInterval: 15_000,
  });

  const result = data ? unwrap<TransactionListResponse>(data) : null;
  const transactions: Transaction[] = result?.data ?? [];

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
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Aucune transaction
            </div>
          ) : (
            transactions.map((tx) => {
              const cfg = getTransactionStatusCfg(tx.status);
              const StatusIcon = cfg.icon;

              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors"
                >
                  <StatusIcon
                    className={clsx(
                      'h-4 w-4 flex-shrink-0',
                      cfg.color,
                      cfg.pulse && 'animate-spin',
                    )}
                    aria-hidden="true"
                  />

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
                    <p className="text-sm font-semibold tabular-nums">
                      {tx.amountXof.toLocaleString('fr-CI')} FCFA
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {format(new Date(tx.createdAt), 'dd/MM HH:mm', {
                        locale: fr,
                      })}
                    </p>
                  </div>

                  <div className="w-20 text-right">
                    <span className={clsx('text-xs font-medium', cfg.color)}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
