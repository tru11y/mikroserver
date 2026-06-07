'use client';

import { Download, FileSpreadsheet, Loader2, Trash2, X } from 'lucide-react';

interface VouchersBulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  onPdf: () => void;
  onCsv: () => void;
  onDelete: () => void;
  canExport: boolean;
  canDelete: boolean;
  isDeletePending: boolean;
}

export function VouchersBulkActionsBar({
  selectedCount,
  onClear,
  onPdf,
  onCsv,
  onDelete,
  canExport,
  canDelete,
  isDeletePending,
}: VouchersBulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Actions sur la sélection"
      aria-live="polite"
      className="sticky top-0 z-20 rounded-lg border border-primary/30 bg-primary/5 backdrop-blur-sm p-2.5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-bold tabular-nums text-primary-foreground">
            {selectedCount}
          </span>
          <p className="text-xs font-medium">
            ticket{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
          </p>
          <button
            type="button"
            onClick={onClear}
            aria-label="Désélectionner tout"
            className="rounded px-1 text-xs text-muted-foreground transition-all duration-200 ease-out hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            · Effacer
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canExport && (
            <>
              <button
                type="button"
                onClick={onPdf}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-all duration-200 ease-out hover:bg-primary/90 hover:shadow-[var(--shadow-glow)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                PDF
              </button>
              <button
                type="button"
                onClick={onCsv}
                className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ease-out hover:bg-muted/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                CSV
              </button>
            </>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeletePending}
              aria-label={`Supprimer ${selectedCount} ticket${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive transition-all duration-200 ease-out hover:bg-destructive/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60"
            >
              {isDeletePending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface BulkDeleteSummaryBannerProps {
  deletedCount: number;
  skippedCount: number;
  skipped: Array<{ voucherId: string; code: string | null; reason: string }>;
  onClose: () => void;
}

export function BulkDeleteSummaryBanner({
  deletedCount,
  skippedCount,
  skipped,
  onClose,
}: BulkDeleteSummaryBannerProps) {
  return (
    <div role="status" aria-live="polite" className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
          {deletedCount} supprimés
        </span>
        <span className="rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
          {skippedCount} conservés
        </span>
        <p className="text-xs text-muted-foreground">
          Les tickets déjà utilisés sont automatiquement protégés.
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le résumé de suppression"
          className="ml-auto rounded p-1 text-muted-foreground transition-all duration-200 ease-out hover:bg-muted hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      {skipped.length > 0 && (
        <ul className="mt-2 space-y-1" aria-label="Tickets conservés">
          {skipped.slice(0, 4).map((item) => (
            <li
              key={`${item.voucherId}-${item.code ?? 'missing'}`}
              className="rounded-md border bg-muted/20 px-2.5 py-1.5"
            >
              <p className="font-mono text-xs font-semibold">{item.code ?? item.voucherId}</p>
              <p className="text-[11px] text-muted-foreground">{item.reason}</p>
            </li>
          ))}
          {skipped.length > 4 && (
            <li className="text-[11px] text-muted-foreground">
              +{skipped.length - 4} autre(s)
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
