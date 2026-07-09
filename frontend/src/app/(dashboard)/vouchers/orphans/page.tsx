'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { AlertTriangle, RefreshCw, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react';

import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { VouchersTabs } from '../vouchers-tabs';
import { VoucherStatusBadge } from '@/components/ui/voucher-status-badge';

type OrphanReason =
  | 'ORPHAN_PLAN'
  | 'ORPHAN_ROUTER'
  | 'STALE_GENERATED'
  | 'DELIVERY_FAILED'
  | 'FAILED_TRANSACTION';

interface OrphanVoucher {
  id: string;
  code: string;
  reason: OrphanReason;
  reasonLabel: string;
  routerName?: string;
  planName?: string;
  status: string;
  createdAt: string;
  safeToDelete: boolean;
  warning?: string;
}

interface UnrecognizedResult {
  items: OrphanVoucher[];
  summary: { total: number; safeToDelete: number; risky: number };
}

interface BulkDeleteResult {
  deleted: string[];
  skipped: Array<{ id: string; code?: string; reason: string }>;
  errors: Array<{ id: string; message: string }>;
}

type ApiError = AxiosError<{ message?: string }>;

function apiMsg(err: unknown, fallback: string): string {
  return (err as ApiError)?.response?.data?.message ?? fallback;
}

const REASON_FILTERS: Array<{ value: OrphanReason | 'ALL' | 'SAFE'; label: string }> = [
  { value: 'ALL', label: 'Tous' },
  { value: 'SAFE', label: 'Supprimables uniquement' },
  { value: 'ORPHAN_PLAN', label: 'Forfait supprimé' },
  { value: 'ORPHAN_ROUTER', label: 'Routeur supprimé' },
  { value: 'STALE_GENERATED', label: 'Non livré (>30j)' },
  { value: 'DELIVERY_FAILED', label: 'Livraison échouée' },
  { value: 'FAILED_TRANSACTION', label: 'Transaction échouée' },
];

function ReasonBadge({ reason }: { reason: OrphanReason }) {
  const styles: Record<OrphanReason, string> = {
    ORPHAN_PLAN:         'bg-orange-500/10 text-orange-400 border-orange-500/20',
    ORPHAN_ROUTER:       'bg-red-500/10 text-red-400 border-red-500/20',
    STALE_GENERATED:     'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    DELIVERY_FAILED:     'bg-rose-500/10 text-rose-400 border-rose-500/20',
    FAILED_TRANSACTION:  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  const labels: Record<OrphanReason, string> = {
    ORPHAN_PLAN:         'Forfait supprimé',
    ORPHAN_ROUTER:       'Routeur supprimé',
    STALE_GENERATED:     'Non livré (>30j)',
    DELIVERY_FAILED:     'Livraison échouée',
    FAILED_TRANSACTION:  'Transaction échouée',
  };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${styles[reason]}`}>
      {labels[reason]}
    </span>
  );
}

export default function OrphansPage() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reasonFilter, setReasonFilter] = useState<OrphanReason | 'ALL' | 'SAFE'>('ALL');
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canView   = hasPermission(currentUser, 'tickets.view');
  const canCreate = hasPermission(currentUser, 'tickets.create');
  const canVerify = hasPermission(currentUser, 'tickets.verify');
  const canDelete = hasPermission(currentUser, 'tickets.delete');

  const {
    data: rawData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['vouchers', 'orphans'],
    queryFn: () => api.vouchers.listUnrecognized(),
    enabled: canView,
  });

  const result = rawData ? unwrap<UnrecognizedResult>(rawData) : null;

  const filtered = useMemo(() => {
    if (!result) return [];
    if (reasonFilter === 'ALL') return result.items;
    if (reasonFilter === 'SAFE') return result.items.filter((v) => v.safeToDelete);
    return result.items.filter((v) => v.reason === reasonFilter);
  }, [result, reasonFilter]);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const selectAllSafe = () => {
    const safeIds = (result?.items ?? []).filter((v) => v.safeToDelete).map((v) => v.id);
    setSelectedIds(safeIds);
  };

  const clearSelection = () => setSelectedIds([]);

  const selectedCount = selectedIds.length;
  const selectedSafeCount = selectedIds.filter(
    (id) => result?.items.find((v) => v.id === id)?.safeToDelete,
  ).length;

  const bulkDeleteMutation = useMutation({
    mutationFn: () => api.vouchers.bulkDeleteUnrecognized(selectedIds),
    onSuccess: (res) => {
      const report = unwrap<BulkDeleteResult>(res);
      const deletedCount = report.deleted.length;
      const skippedCount = report.skipped.length;
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      setSelectedIds([]);
      setShowConfirm(false);
      if (deletedCount > 0) {
        toast.success(
          `${deletedCount} ticket${deletedCount > 1 ? 's' : ''} supprimé${deletedCount > 1 ? 's' : ''}${skippedCount > 0 ? ` · ${skippedCount} ignoré${skippedCount > 1 ? 's' : ''}` : ''}.`,
        );
      } else {
        toast.info('Aucun ticket supprimé. Tous ont été ignorés.');
      }
    },
    onError: (err) => {
      toast.error(apiMsg(err, 'Erreur lors de la suppression.'));
    },
  });

  if (!canView) {
    return (
      <div className="space-y-4">
        <VouchersTabs permissions={{ canView: false, canCreate, canVerify }} />
        <div className="rounded-lg border bg-card p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <h1 className="mt-3 text-base font-semibold">Accès limité</h1>
          <p className="mt-1 text-sm text-muted-foreground">Permission tickets.view requise.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <VouchersTabs permissions={{ canView, canCreate, canVerify }} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tickets orphelins</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Tickets problématiques ou non reconnus pouvant être nettoyés en sécurité.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </button>
      </div>

      {/* KPIs */}
      {result && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total détectés</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{result.summary.total}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-green-500">Supprimables</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-green-500">{result.summary.safeToDelete}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-400">À vérifier</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-orange-400">{result.summary.risky}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {REASON_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setReasonFilter(f.value); clearSelection(); }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              reasonFilter === f.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bulk actions toolbar */}
      {canDelete && (
        <div className="flex items-center gap-2">
          <button
            onClick={selectAllSafe}
            className="rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Sélectionner tous les supprimables
          </button>
          {selectedCount > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selectedCount} sélectionné(s)</span>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={selectedSafeCount === 0}
                className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer la sélection ({selectedSafeCount} sûr{selectedSafeCount > 1 ? 's' : ''})
              </button>
              <button
                onClick={clearSelection}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Annuler
              </button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive/60" />
          <p className="mt-2 text-sm font-medium">Erreur de chargement</p>
          <button
            onClick={() => refetch()}
            className="mt-3 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Réessayer
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-green-500/60" />
          <h2 className="mt-3 text-base font-semibold">
            {result?.summary.total === 0
              ? 'Aucun ticket orphelin détecté'
              : 'Aucun résultat pour ce filtre'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result?.summary.total === 0
              ? 'Tous les tickets sont dans un état reconnu et valide.'
              : 'Essayez un autre filtre.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/40">
              <tr>
                {canDelete && <th className="w-8 px-3 py-2.5 text-left" />}
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Code</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Raison</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Forfait</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Routeur</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Statut</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Sécurité</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v) => (
                <tr key={v.id} className="transition hover:bg-muted/20">
                  {canDelete && (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(v.id)}
                        onChange={() => toggleSelect(v.id)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <span className="font-mono font-semibold tracking-wider">{v.code}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <ReasonBadge reason={v.reason} />
                      {v.warning && (
                        <span className="flex items-center gap-1 text-[10px] text-orange-400">
                          <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" />
                          {v.warning}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{v.planName ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{v.routerName ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <VoucherStatusBadge status={v.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    {v.safeToDelete ? (
                      <span className="inline-flex items-center gap-1 text-green-400">
                        <ShieldCheck className="h-3 w-3" />
                        Supprimable
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-orange-400">
                        <ShieldAlert className="h-3 w-3" />
                        À vérifier
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {new Date(v.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={showConfirm}
        title="Supprimer les tickets orphelins"
        description={`Vous allez supprimer ${selectedSafeCount} ticket${selectedSafeCount > 1 ? 's' : ''} orphelin${selectedSafeCount > 1 ? 's' : ''} considéré${selectedSafeCount > 1 ? 's' : ''} comme sûr${selectedSafeCount > 1 ? 's' : ''}. Cette action est irréversible. Les tickets risqués seront ignorés.`}
        isLoading={bulkDeleteMutation.isPending}
        onConfirm={() => bulkDeleteMutation.mutate()}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
