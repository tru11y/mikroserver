'use client';

import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TableRowSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { InvoiceStatusBadge } from '@/components/ui/invoice-status-badge';
import { formatXof } from '@/lib/formatters';
import type { Invoice, InvoiceStatus } from '@/lib/api/accounting';

type StatusFilter = InvoiceStatus | 'ALL';

const SECTION_ID = 'accounting-invoices-heading';

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'PAID', label: 'Payées' },
  { value: 'SENT', label: 'Envoyées' },
  { value: 'OVERDUE', label: 'En retard' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'CANCELLED', label: 'Annulées' },
];

const TABLE_HEADERS = ['N°', 'Type', 'Période', 'Émission', 'Échéance', 'Montant TTC', 'Statut', ''];

const PDF_LINK_CLASS = clsx(
  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary',
  'hover:bg-primary/10 transition-all duration-200 ease-out active:scale-[0.98]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
);

function pdfHref(id: string) {
  return `/proxy/api/v1/accounting/invoices/${id}/pdf`;
}

function InvoiceTypeLabel({ type }: { type: string }) {
  return <>{type === 'PLATFORM_FEE' ? 'Abonnement plateforme' : type}</>;
}

function InvoiceRow({ inv }: { inv: Invoice }) {
  const isOverdue = inv.status === 'OVERDUE';
  return (
    <tr
      className={clsx(
        'border-b border-border/40 transition-colors duration-150 hover:bg-muted/20',
        isOverdue && 'border-l-2 border-l-destructive bg-destructive/[0.03]',
      )}
    >
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.number}</td>
      <td className="px-4 py-3 text-sm">
        <InvoiceTypeLabel type={inv.type} />
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {inv.periodStart
          ? format(new Date(inv.periodStart), 'MMM yyyy', { locale: fr })
          : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">
        {format(new Date(inv.createdAt), 'dd MMM yyyy', { locale: fr })}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums">
        {inv.dueDate ? (
          <span className={clsx(isOverdue && 'text-destructive font-medium')}>
            {format(new Date(inv.dueDate), 'dd MMM yyyy', { locale: fr })}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3 text-right font-bold tabular-nums text-sm">
        {formatXof(inv.totalXof)}
      </td>
      <td className="px-4 py-3">
        <InvoiceStatusBadge status={inv.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <a
          href={pdfHref(inv.id)}
          download={`facture-${inv.number}.pdf`}
          aria-label={`Télécharger la facture ${inv.number}`}
          className={PDF_LINK_CLASS}
        >
          <Download className="h-3 w-3" aria-hidden="true" />
          PDF
        </a>
      </td>
    </tr>
  );
}

function InvoiceCard({ inv }: { inv: Invoice }) {
  const isOverdue = inv.status === 'OVERDUE';
  return (
    <div
      className={clsx(
        'rounded-xl border bg-card p-4 space-y-2.5',
        isOverdue && 'border-l-4 border-l-destructive',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{inv.number}</p>
          <p className="text-sm font-medium mt-0.5">
            <InvoiceTypeLabel type={inv.type} />
          </p>
        </div>
        <InvoiceStatusBadge status={inv.status} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xl font-bold tabular-nums">{formatXof(inv.totalXof)}</p>
        <a
          href={pdfHref(inv.id)}
          download={`facture-${inv.number}.pdf`}
          aria-label={`Télécharger la facture ${inv.number}`}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-primary',
            'hover:bg-primary/10 transition-all duration-200 ease-out active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          PDF
        </a>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {inv.periodStart && (
          <span>
            Période : {format(new Date(inv.periodStart), 'MMM yyyy', { locale: fr })}
          </span>
        )}
        {inv.dueDate && (
          <span className={clsx(isOverdue && 'text-destructive font-medium')}>
            Échéance : {format(new Date(inv.dueDate), 'dd MMM yyyy', { locale: fr })}
          </span>
        )}
      </div>
    </div>
  );
}

interface Props {
  invoices: Invoice[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function AccountingInvoicesSection({ invoices, total, isLoading, isError, onRetry }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const filtered =
    statusFilter === 'ALL' ? invoices : invoices.filter((inv) => inv.status === statusFilter);

  const isEmpty = !isLoading && !isError && filtered.length === 0;

  return (
    <section aria-labelledby={SECTION_ID} className="space-y-3">
      <h2 id={SECTION_ID} className="font-semibold text-sm flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Factures
        {!isLoading && !isError && (
          <span className="text-muted-foreground font-normal">({total})</span>
        )}
      </h2>

      <div
        className="flex gap-1 overflow-x-auto pb-0.5"
        role="group"
        aria-label="Filtrer par statut"
      >
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={statusFilter === opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={clsx(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
              'transition-all duration-150 active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
              'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              statusFilter === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {TABLE_HEADERS.map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={8} />
              ))}
            </tbody>
          </table>
        ) : isError ? (
          <div className="p-6">
            <ErrorState onRetry={onRetry} />
          </div>
        ) : isEmpty ? (
          <div className="p-6">
            <EmptyState
              title="Aucune facture"
              description="Aucune facture ne correspond à ce filtre."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">N°</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Période</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Émission</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Échéance</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Montant TTC</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground sr-only">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <InvoiceRow key={inv.id} inv={inv} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-2.5 animate-pulse">
              <div className="flex justify-between">
                <div className="space-y-1.5">
                  <div className="h-3 bg-muted rounded w-20" />
                  <div className="h-4 bg-muted rounded w-40" />
                </div>
                <div className="h-5 bg-muted rounded-full w-16" />
              </div>
              <div className="flex justify-between items-center">
                <div className="h-6 bg-muted rounded w-28" />
                <div className="h-7 bg-muted rounded-lg w-14" />
              </div>
            </div>
          ))
        ) : isError ? (
          <ErrorState onRetry={onRetry} />
        ) : isEmpty ? (
          <EmptyState
            title="Aucune facture"
            description="Aucune facture ne correspond à ce filtre."
          />
        ) : (
          filtered.map((inv) => <InvoiceCard key={inv.id} inv={inv} />)
        )}
      </div>
    </section>
  );
}
