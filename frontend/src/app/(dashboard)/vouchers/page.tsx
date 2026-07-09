'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { Layers, Ticket, X } from 'lucide-react';

import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { VouchersTabs } from './vouchers-tabs';
import { VouchersKpiStrip } from './vouchers-kpi-strip';
import { VouchersFilterBar } from './vouchers-filter-bar';
import { VouchersBulkActionsBar, BulkDeleteSummaryBanner } from './vouchers-bulk-actions-bar';
import { VouchersTableSection, type Voucher } from './vouchers-table-section';

interface BulkDeleteSummary {
  requestedCount: number;
  deletedCount: number;
  skippedCount: number;
  deleted: Array<{ voucherId: string; code: string }>;
  skipped: Array<{ voucherId: string; code: string | null; reason: string }>;
}

type ApiError = AxiosError<{ message?: string }>;

function apiMsg(err: unknown, fallback: string): string {
  return (err as ApiError)?.response?.data?.message ?? fallback;
}

export default function VouchersPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [usageFilter, setUsageFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [bulkDeleteSummary, setBulkDeleteSummary] = useState<BulkDeleteSummary | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [confirmDeleteVoucherId, setConfirmDeleteVoucherId] = useState<string | null>(null);
  const [activeBatch, setActiveBatch] = useState<{ id: string; number: number } | null>(null);

  useEffect(() => {
    const usageState = searchParams.get('usageState');
    if (usageState && ['ALL', 'UNUSED', 'READY', 'USED', 'ISSUES'].includes(usageState)) {
      setUsageFilter(usageState);
    }
    const batchId = searchParams.get('batchId');
    const batchNumber = searchParams.get('batchNumber');
    if (batchId && batchNumber && batchId !== activeBatch?.id) {
      const num = parseInt(batchNumber, 10);
      setActiveBatch({ id: batchId, number: num });
      api.vouchers.getBatchIds(batchId).then((res) => {
        const ids = (res?.data?.data as string[]) ?? [];
        if (ids.length) {
          setSelectedIds(ids);
          toast.success(`${ids.length} ticket(s) du lot #${num} sélectionnés`);
        }
      }).catch(() => {
        toast.error('Impossible de charger les tickets du lot');
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canView    = hasPermission(currentUser, 'tickets.view');
  const canCreate  = hasPermission(currentUser, 'tickets.create');
  const canVerify  = hasPermission(currentUser, 'tickets.verify');
  const canUpdate  = hasPermission(currentUser, 'tickets.update');
  const canDelete  = hasPermission(currentUser, 'tickets.delete');
  const canExport  = hasPermission(currentUser, 'tickets.export');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vouchers', page, statusFilter, usageFilter, search],
    queryFn: () => api.vouchers.list(page, 20, { status: statusFilter, usageState: usageFilter, search }),
    enabled: canView,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['vouchers'] });
    await queryClient.invalidateQueries({ queryKey: ['sessions'] });
    await queryClient.invalidateQueries({ queryKey: ['metrics'] });
  };

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.vouchers.revoke(id),
    onSuccess: async () => { await invalidate(); toast.success('Ticket révoqué'); },
    onError: (err) => toast.error(apiMsg(err, 'Révocation impossible')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.vouchers.remove(id),
    onSuccess: async () => { await invalidate(); toast.success('Ticket supprimé'); },
    onError: (err) => toast.error(apiMsg(err, 'Suppression impossible')),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.vouchers.bulkDelete(ids),
    onSuccess: async (response) => {
      const summary = response ? unwrap<BulkDeleteSummary>(response) : undefined;
      await invalidate();
      if (!summary) { setSelectedIds([]); toast.success('Suppression terminée'); return; }
      const deletedIds = new Set(summary.deleted.map((d) => d.voucherId));
      setSelectedIds((cur) => cur.filter((id) => !deletedIds.has(id)));
      setBulkDeleteSummary(summary);
      if (summary.deletedCount > 0 && summary.skippedCount === 0) {
        toast.success(`${summary.deletedCount} ticket(s) supprimé(s)`);
      } else if (summary.deletedCount > 0) {
        toast.success(`${summary.deletedCount} supprimés, ${summary.skippedCount} conservés`);
      } else {
        toast.error("Aucun ticket sélectionné n'a pu être supprimé");
      }
    },
    onError: (err) => toast.error(apiMsg(err, 'Suppression de lot impossible')),
    onSettled: () => invalidate(),
  });

  const redeliverMutation = useMutation({
    mutationFn: (id: string) => api.vouchers.redeliver(id),
    onSuccess: async () => { await invalidate(); toast.success('Relivraison relancée'); },
    onError: (err) => toast.error(apiMsg(err, 'Relivraison impossible')),
  });

  const result = (data ? unwrap<{ items?: Voucher[]; total?: number }>(data) : null) ?? {};
  const vouchers: Voucher[] = result.items ?? [];
  const total: number = result.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const allPageSelected = vouchers.length > 0 && vouchers.every((v) => selectedIds.includes(v.id));
  const selectedVouchers = vouchers.filter((v) => selectedIds.includes(v.id));

  const handleDownloadPdf = async () => {
    if (!selectedVouchers.length || !canExport) return;
    try {
      const res = await api.vouchers.downloadPdf(selectedVouchers.map((v) => v.id));
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tickets-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF généré');
    } catch (err) {
      toast.error(apiMsg(err, 'Export PDF impossible'));
    }
  };

  const handleDownloadCsv = () => {
    if (!canExport) return;
    const rows = (selectedVouchers.length ? selectedVouchers : vouchers).map((v) => ({
      code: v.code, statut: v.status, forfait: v.planName ?? '',
      routeur: v.routerName ?? '', creeLe: v.createdAt,
      activeLe: v.activatedAt ?? '', expireLe: v.expiresAt ?? '',
    }));
    const header = ['code', 'statut', 'forfait', 'routeur', 'creeLe', 'activeLe', 'expireLe'];
    const lines = [
      header.join(';'),
      ...rows.map((row) =>
        header.map((k) => `"${String(row[k as keyof typeof row] ?? '').replace(/"/g, '""')}"`).join(';'),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exporté');
  };

  const toggleSelected = (id: string) =>
    setSelectedIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);

  const toggleSelectPage = () => {
    const pageIds = vouchers.map((v) => v.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((cur) => cur.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((cur) => Array.from(new Set([...cur, ...pageIds])));
    }
  };

  const clearFilters = () => { setStatusFilter('ALL'); setUsageFilter('ALL'); setSearch(''); setPage(1); };

  if (isMeLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-4">
        <VouchersTabs permissions={{ canView: false, canCreate, canVerify }} />
        <div className="rounded-lg border bg-card p-8 text-center">
          <Ticket className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <h1 className="mt-3 text-base font-semibold">Accès limité</h1>
          <p className="mt-1 text-xs text-muted-foreground">Votre profil ne permet pas de consulter les tickets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <VouchersTabs
        permissions={{ canView, canCreate, canVerify }}
        badges={{ issues: undefined }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tickets</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {total} ticket{total > 1 ? 's' : ''} au total
          </p>
        </div>
      </div>

      <VouchersKpiStrip canView={canView} />

      {activeBatch && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="font-medium text-primary">Lot #{activeBatch.number}</span>
            <span className="text-muted-foreground">— {selectedIds.length} ticket(s) sélectionné(s)</span>
          </div>
          <button
            type="button"
            onClick={() => { setActiveBatch(null); setSelectedIds([]); }}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Désactiver le filtre lot"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <VouchersFilterBar
        search={search}
        statusFilter={statusFilter}
        usageFilter={usageFilter}
        onSearchChange={(v) => { setPage(1); setSearch(v); }}
        onStatusChange={(v) => { setPage(1); setStatusFilter(v); }}
        onUsageChange={(v) => { setPage(1); setUsageFilter(v); }}
        onReset={clearFilters}
      />

      <VouchersBulkActionsBar
        selectedCount={selectedIds.length}
        onClear={() => { setSelectedIds([]); setBulkDeleteSummary(null); }}
        onPdf={handleDownloadPdf}
        onCsv={handleDownloadCsv}
        onDelete={() => { if (canDelete && selectedIds.length > 0 && !bulkDeleteMutation.isPending) setShowBulkDeleteConfirm(true); }}
        canExport={canExport}
        canDelete={canDelete}
        isDeletePending={bulkDeleteMutation.isPending}
      />

      {bulkDeleteSummary && (
        <BulkDeleteSummaryBanner
          deletedCount={bulkDeleteSummary.deletedCount}
          skippedCount={bulkDeleteSummary.skippedCount}
          skipped={bulkDeleteSummary.skipped}
          onClose={() => setBulkDeleteSummary(null)}
        />
      )}

      <VouchersTableSection
        vouchers={vouchers}
        isLoading={isLoading}
        isError={isError}
        onRefetch={() => refetch()}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelected}
        onToggleSelectPage={toggleSelectPage}
        allPageSelected={allPageSelected}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        permissions={{ canUpdate, canDelete }}
        onRevoke={(id) => revokeMutation.mutate(id)}
        onRedeliver={(id) => redeliverMutation.mutate(id)}
        onDeleteRequest={setConfirmDeleteVoucherId}
        isRevokePending={revokeMutation.isPending}
        isRedeliverPending={redeliverMutation.isPending}
        isDeletePending={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={showBulkDeleteConfirm}
        title={`Supprimer ${selectedIds.length} ticket(s) ?`}
        description="Les tickets déjà utilisés ou protégés seront conservés automatiquement."
        confirmLabel="Supprimer"
        isLoading={bulkDeleteMutation.isPending}
        onConfirm={() => { setShowBulkDeleteConfirm(false); setBulkDeleteSummary(null); bulkDeleteMutation.mutate(selectedIds); }}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      {confirmDeleteVoucherId && (
        <ConfirmDialog
          open={true}
          title={`Supprimer ${vouchers.find((v) => v.id === confirmDeleteVoucherId)?.code ?? ''} ?`}
          description="Action irréversible sur un ticket jamais utilisé."
          confirmLabel="Supprimer"
          isLoading={deleteMutation.isPending}
          onConfirm={() => { deleteMutation.mutate(confirmDeleteVoucherId); setConfirmDeleteVoucherId(null); }}
          onCancel={() => setConfirmDeleteVoucherId(null)}
        />
      )}
    </div>
  );
}
