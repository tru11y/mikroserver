'use client';

import { Ban, ChevronLeft, ChevronRight, Loader2, RefreshCw, Ticket, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { VoucherStatusBadge } from '@/components/ui/voucher-status-badge';
import { VoucherCodeCell } from '@/components/ui/voucher-code-cell';
import { TableRowSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';

export interface Voucher {
  id: string;
  code: string;
  status: string;
  planName?: string;
  routerName?: string | null;
  generationType?: 'AUTO' | 'MANUAL';
  lastDeliveryError?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

interface Permissions {
  canUpdate: boolean;
  canDelete: boolean;
}

interface VouchersTableSectionProps {
  vouchers: Voucher[];
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectPage: () => void;
  allPageSelected: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  permissions: Permissions;
  onRevoke: (id: string) => void;
  onRedeliver: (id: string) => void;
  onDeleteRequest: (id: string) => void;
  isRevokePending: boolean;
  isRedeliverPending: boolean;
  isDeletePending: boolean;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function safeToDelete(voucher: Voucher): boolean {
  return (
    ['GENERATED', 'DELIVERY_FAILED', 'DELIVERED', 'REVOKED'].includes(voucher.status) &&
    !voucher.activatedAt
  );
}

const ICON_BTN =
  'rounded p-1.5 transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50';

export function VouchersTableSection({
  vouchers,
  isLoading,
  isError,
  onRefetch,
  selectedIds,
  onToggleSelect,
  onToggleSelectPage,
  allPageSelected,
  page,
  totalPages,
  total,
  onPageChange,
  permissions,
  onRevoke,
  onRedeliver,
  onDeleteRequest,
  isRevokePending,
  isRedeliverPending,
  isDeletePending,
}: VouchersTableSectionProps) {
  if (isError) {
    return (
      <div className="rounded-lg border bg-card">
        <ErrorState
          title="Impossible de charger les tickets"
          message="Vérifiez votre connexion et réessayez."
          onRetry={onRefetch}
          className="py-12"
        />
      </div>
    );
  }

  return (
    <section aria-labelledby="vouchers-table-heading" className="rounded-lg border bg-card overflow-hidden">
      <h2 id="vouchers-table-heading" className="sr-only">Liste des tickets</h2>

      {isLoading ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Chargement des tickets en cours" aria-busy="true">
            <thead>
              <tr className="border-b bg-muted/30">
                <th scope="col" className="w-8 px-3 py-2"><span className="sr-only">Sélection</span></th>
                <th scope="col" className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Code</th>
                <th scope="col" className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Forfait</th>
                <th scope="col" className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Activé</th>
                <th scope="col" className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Expire</th>
                <th scope="col" className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Statut</th>
                <th scope="col" className="px-3 py-2 w-24"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={7} />
              ))}
            </tbody>
          </table>
        </div>
      ) : vouchers.length === 0 ? (
        <EmptyState
          icon={<Ticket className="h-5 w-5" />}
          title="Aucun ticket"
          description="Ajustez les filtres ou générez un nouveau lot."
          className="py-12"
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label={`${total} ticket${total > 1 ? 's' : ''}`}>
              <thead>
                <tr className="border-b bg-muted/30">
                  <th scope="col" className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={onToggleSelectPage}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-border"
                      aria-label="Tout sélectionner sur cette page"
                    />
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Code</th>
                  <th scope="col" className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Forfait</th>
                  <th scope="col" className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Activé</th>
                  <th scope="col" className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Expire</th>
                  <th scope="col" className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Statut</th>
                  <th scope="col" className="px-3 py-2 w-24"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {vouchers.map((voucher) => {
                  const isSelected = selectedIds.includes(voucher.id);
                  return (
                    <tr
                      key={voucher.id}
                      className={clsx('transition-colors hover:bg-muted/20', isSelected && 'bg-primary/5')}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect(voucher.id)}
                          className="h-3.5 w-3.5 cursor-pointer rounded border-border"
                          aria-label={`Sélectionner le ticket ${voucher.code}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <VoucherCodeCell
                          code={voucher.code}
                          subtext={`${voucher.routerName ?? 'Sans routeur'} · ${voucher.generationType === 'MANUAL' ? 'Manuel' : 'Auto'}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs">{voucher.planName ?? '—'}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Créé {formatDistanceToNow(new Date(voucher.createdAt), { addSuffix: true, locale: fr })}
                        </p>
                      </td>
                      <td className="hidden px-3 py-2 md:table-cell">
                        <p className="tabular-nums text-xs text-muted-foreground">{formatDate(voucher.activatedAt)}</p>
                      </td>
                      <td className="hidden px-3 py-2 md:table-cell">
                        <p className="tabular-nums text-xs text-muted-foreground">{formatDate(voucher.expiresAt)}</p>
                        {voucher.expiresAt && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                            {formatDistanceToNow(new Date(voucher.expiresAt), { addSuffix: true, locale: fr })}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <VoucherStatusBadge status={voucher.status} />
                        {voucher.lastDeliveryError && (
                          <p
                            className="mt-1 max-w-48 truncate text-[10px] text-warning"
                            title={voucher.lastDeliveryError}
                          >
                            {voucher.lastDeliveryError}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          {['GENERATED', 'DELIVERY_FAILED'].includes(voucher.status) && permissions.canUpdate && (
                            <button
                              type="button"
                              onClick={() => onRedeliver(voucher.id)}
                              disabled={isRedeliverPending}
                              aria-label={`Relivrer le ticket ${voucher.code}`}
                              title="Relivrer"
                              className={clsx(ICON_BTN, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                            >
                              {isRedeliverPending
                                ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                : <RefreshCw className="h-3 w-3" aria-hidden="true" />
                              }
                            </button>
                          )}
                          {['GENERATED', 'DELIVERED', 'ACTIVE', 'DELIVERY_FAILED'].includes(voucher.status) && permissions.canUpdate && (
                            <button
                              type="button"
                              onClick={() => onRevoke(voucher.id)}
                              disabled={isRevokePending}
                              aria-label={`Révoquer le ticket ${voucher.code}`}
                              title="Révoquer"
                              className={clsx(ICON_BTN, 'text-destructive hover:bg-destructive/10')}
                            >
                              {isRevokePending
                                ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                : <Ban className="h-3 w-3" aria-hidden="true" />
                              }
                            </button>
                          )}
                          {safeToDelete(voucher) && permissions.canDelete && (
                            <button
                              type="button"
                              onClick={() => onDeleteRequest(voucher.id)}
                              disabled={isDeletePending}
                              aria-label={`Supprimer le ticket ${voucher.code}`}
                              title="Supprimer"
                              className={clsx(ICON_BTN, 'text-destructive hover:bg-destructive/10')}
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav
              className="flex items-center justify-between border-t px-4 py-2.5"
              aria-label="Pagination des tickets"
            >
              <span className="tabular-nums text-xs text-muted-foreground">
                Page {page} / {totalPages} · {total} total
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                  disabled={page === 1}
                  aria-label="Page précédente"
                  className="rounded-md border p-1.5 transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  aria-label="Page suivante"
                  className="rounded-md border p-1.5 transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
