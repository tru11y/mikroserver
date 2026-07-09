'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock, Database, Users, Wifi } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatBytes } from '@/lib/format';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { CustomerStatusBadge } from '@/components/ui/customer-status-badge';
import { MacAddressCell } from '@/components/ui/mac-address-cell';
import { CustomersBanButton } from './customers-ban-button';
import type { CustomerProfile } from '@/lib/api/customers';

const SECTION_ID = 'customers-list-heading';

interface CustomersListSectionProps {
  items: CustomerProfile[] | undefined;
  total: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canBlock: boolean;
  onBlock: (id: string, isBlocked: boolean) => void;
  isBlockPending: boolean;
  search: string;
}

export function CustomersListSection({
  items,
  total,
  isLoading,
  isError,
  onRetry,
  page,
  totalPages,
  onPageChange,
  canBlock,
  onBlock,
  isBlockPending,
  search,
}: CustomersListSectionProps) {
  return (
    <section aria-labelledby={SECTION_ID} className="space-y-3">
      <h2 id={SECTION_ID} className="sr-only">
        Liste des clients
      </h2>

      <div className="rounded-lg border bg-card overflow-hidden">
        {isLoading ? (
          <>
            {/* Mobile skeleton */}
            <ul className="md:hidden divide-y divide-border/50">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-9 w-9 rounded-md shrink-0" />
                  </div>
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop skeleton */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <TableHead />
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={7} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : isError ? (
          <ErrorState
            title="Impossible de charger les clients"
            message="Vérifiez votre connexion et réessayez."
            onRetry={onRetry}
            className="m-4"
          />
        ) : !items?.length ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Aucun client"
            description={
              search
                ? 'Aucun résultat pour cette recherche.'
                : 'Les clients apparaîtront après leurs premières connexions.'
            }
            className="m-4"
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="md:hidden divide-y divide-border/50">
              {items.map((c) => (
                <li key={c.id} className={clsx('p-3', c.isBlocked && 'opacity-70')}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/customers/${c.id}`} className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <MacAddressCell mac={c.macAddress} className="text-primary" />
                        <CustomerStatusBadge isBlocked={c.isBlocked} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.firstName
                          ? `${c.firstName} ${c.lastName ?? ''}`.trim()
                          : (c.lastUsername ?? '—')}
                      </p>
                    </Link>
                    <CustomersBanButton
                      customerId={c.id}
                      isBlocked={c.isBlocked}
                      canBlock={canBlock}
                      isPending={isBlockPending}
                      onMutate={(blocked) => onBlock(c.id, blocked)}
                      variant="icon"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Wifi className="h-2.5 w-2.5" aria-hidden="true" />
                      {c.router.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                      {formatDistanceToNow(new Date(c.lastSeenAt), { addSuffix: true, locale: fr })}
                    </span>
                    <span>{c.totalSessions} sess.</span>
                    <span className="flex items-center gap-1">
                      <Database className="h-2.5 w-2.5" aria-hidden="true" />
                      {formatBytes(c.totalDataBytes)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <TableHead />
                </thead>
                <tbody className="divide-y divide-border/50">
                  {items.map((c) => (
                    <tr
                      key={c.id}
                      className={clsx(
                        'hover:bg-muted/20 transition-colors group',
                        c.isBlocked && 'opacity-70',
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <MacAddressCell
                            mac={c.macAddress}
                            href={`/customers/${c.id}`}
                            className="group-hover:text-primary"
                          />
                          <CustomerStatusBadge isBlocked={c.isBlocked} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.firstName
                            ? `${c.firstName} ${c.lastName ?? ''}`.trim()
                            : (c.lastUsername ?? '—')}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Wifi className="h-3 w-3 text-primary" aria-hidden="true" />
                          {c.router.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                        {format(new Date(c.firstSeenAt), 'dd MMM yyyy', { locale: fr })}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.lastSeenAt), { addSuffix: true, locale: fr })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                        {c.totalSessions}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs hidden lg:table-cell text-muted-foreground">
                        <span className="flex items-center justify-end gap-1">
                          <Database className="h-3 w-3" aria-hidden="true" />
                          {formatBytes(c.totalDataBytes)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <CustomersBanButton
                          customerId={c.id}
                          isBlocked={c.isBlocked}
                          canBlock={canBlock}
                          isPending={isBlockPending}
                          onMutate={(blocked) => onBlock(c.id, blocked)}
                          variant="icon"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Pagination clients"
          className="flex items-center justify-center gap-2"
        >
          <button
            type="button"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1.5 rounded-md border hover:bg-muted active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite" aria-atomic="true">
            Page {page} / {totalPages} · {total} client{total !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-1.5 rounded-md border hover:bg-muted active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </section>
  );
}

function TableHead() {
  return (
    <tr className="border-b bg-muted/30">
      {[
        { label: 'Client', align: 'left', className: '' },
        { label: 'Routeur', align: 'left', className: '' },
        { label: '1ère connexion', align: 'left', className: 'hidden lg:table-cell' },
        { label: 'Dernière vue', align: 'left', className: '' },
        { label: 'Sessions', align: 'right', className: '' },
        { label: 'Data', align: 'right', className: 'hidden lg:table-cell' },
        { label: 'Actions', align: 'center', className: 'w-12', sr: true },
      ].map(({ label, align, className, sr }) => (
        <th
          key={label}
          className={clsx(
            'px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest',
            align === 'right' ? 'text-right' : 'text-left',
            className,
          )}
        >
          {sr ? <span className="sr-only">{label}</span> : label}
        </th>
      ))}
    </tr>
  );
}
