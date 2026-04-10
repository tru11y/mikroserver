'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import {
  Ticket,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  RefreshCw,
  Download,
  Search,
  Ban,
  FileSpreadsheet,
  CheckSquare,
  Layers,
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Voucher {
  id: string;
  code: string;
  status: 'GENERATED' | 'DELIVERED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DELIVERY_FAILED';
  planName?: string;
  planDurationMinutes?: number;
  generationType?: 'AUTO' | 'MANUAL';
  routerName?: string | null;
  lastDeliveryError?: string | null;
  deliveryAttempts?: number;
  expiresAt?: string | null;
  activatedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

interface BulkDeleteSummary {
  requestedCount: number;
  deletedCount: number;
  skippedCount: number;
  deleted: Array<{
    voucherId: string;
    code: string;
  }>;
  skipped: Array<{
    voucherId: string;
    code: string | null;
    reason: string;
  }>;
}

const STATUS_CFG = {
  GENERATED: { label: 'Généré', icon: Clock, color: 'text-slate-400', bg: 'bg-slate-400/10 border-slate-400/20' },
  DELIVERED: { label: 'Livré', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  ACTIVE: { label: 'Actif', icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  EXPIRED: { label: 'Expiré', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
  REVOKED: { label: 'Révoqué', icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
  DELIVERY_FAILED: { label: 'Échec livraison', icon: XCircle, color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
} as const;

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Tous' },
  { value: 'GENERATED', label: 'Générés' },
  { value: 'DELIVERED', label: 'Livrés' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'EXPIRED', label: 'Expirés' },
  { value: 'REVOKED', label: 'Révoqués' },
  { value: 'DELIVERY_FAILED', label: 'Échec livraison' },
];

const USAGE_FILTERS = [
  { value: 'ALL', label: 'Vue complète' },
  { value: 'UNUSED', label: 'Jamais utilisés' },
  { value: 'READY', label: 'Prêts à vendre' },
  { value: 'USED', label: 'Déjà utilisés' },
  { value: 'ISSUES', label: 'En problème' },
];

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR');
}

interface Plan {
  id: string;
  name: string;
  priceXof: number;
  durationMinutes: number;
}

interface Router {
  id: string;
  name: string;
  status: string;
}

export default function VouchersPage() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [usageFilter, setUsageFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [bulkDeleteSummary, setBulkDeleteSummary] = useState<BulkDeleteSummary | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [confirmDeleteVoucherId, setConfirmDeleteVoucherId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const usageState = searchParams.get('usageState');
    if (usageState && USAGE_FILTERS.some((item) => item.value === usageState)) {
      setUsageFilter(usageState);
    }
  }, [searchParams]);

  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canViewTickets = hasPermission(currentUser, 'tickets.view');

  const { data, isLoading } = useQuery({
    queryKey: ['vouchers', page, statusFilter, usageFilter, search],
    queryFn: () => api.vouchers.list(page, 20, { status: statusFilter, usageState: usageFilter, search }),
    enabled: canViewTickets,
  });

  const invalidateVoucherQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['vouchers'] });
    await queryClient.invalidateQueries({ queryKey: ['sessions'] });
    await queryClient.invalidateQueries({ queryKey: ['metrics'] });
  };

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.vouchers.revoke(id),
    onSuccess: async () => {
      await invalidateVoucherQueries();
      toast.success('Ticket révoqué');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Révocation impossible');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.vouchers.remove(id),
    onSuccess: async () => {
      await invalidateVoucherQueries();
      toast.success('Ticket supprimé');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Suppression impossible');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.vouchers.bulkDelete(ids),
    onSuccess: async (response) => {
      const summary = response ? unwrap<BulkDeleteSummary>(response) : undefined;
      await invalidateVoucherQueries();
      if (!summary) {
        setSelectedIds([]);
        toast.success('Suppression terminee');
        return;
      }

      const deletedIds = new Set(summary.deleted.map((item) => item.voucherId));
      setSelectedIds((current) => current.filter((id) => !deletedIds.has(id)));
      setBulkDeleteSummary(summary);

      if (summary.deletedCount > 0 && summary.skippedCount === 0) {
        toast.success(`${summary.deletedCount} ticket(s) supprimé(s)`);
        return;
      }

      if (summary.deletedCount > 0 && summary.skippedCount > 0) {
        toast.success(
          `${summary.deletedCount} ticket(s) supprimé(s), ${summary.skippedCount} conservé(s)`,
        );
        return;
      }

      toast.error("Aucun ticket selectionne n'a pu etre supprime");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Suppression de lot impossible');
    },
  });

  const redeliverMutation = useMutation({
    mutationFn: (id: string) => api.vouchers.redeliver(id),
    onSuccess: async () => {
      await invalidateVoucherQueries();
      toast.success('Relivraison relancée');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? 'Relivraison impossible');
    },
  });

  const result = (data ? unwrap<{ items?: Voucher[]; total?: number }>(data) : null) ?? {};
  const vouchers: Voucher[] = result.items ?? [];
  const total: number = result.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const canDeleteTickets = hasPermission(currentUser, 'tickets.delete');
  const canExportTickets = hasPermission(currentUser, 'tickets.export');
  const canUpdateTickets = hasPermission(currentUser, 'tickets.update');
  const allPageSelected =
    vouchers.length > 0 && vouchers.every((voucher) => selectedIds.includes(voucher.id));
  const selectedVouchers = vouchers.filter((voucher) => selectedIds.includes(voucher.id));
  const safeToDelete = (voucher: Voucher) =>
    ['GENERATED', 'DELIVERY_FAILED', 'DELIVERED', 'REVOKED'].includes(voucher.status) &&
    !voucher.activatedAt;

  const handleDownloadPdf = async () => {
    if (!selectedVouchers.length || !canExportTickets) return;

    try {
      const res = await api.vouchers.downloadPdf(selectedVouchers.map((voucher) => voucher.id));
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tickets-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF généré');
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Export PDF impossible');
    }
  };

  const handleDownloadCsv = () => {
    if (!canExportTickets) return;

    const exportRows = (selectedVouchers.length ? selectedVouchers : vouchers).map((voucher) => ({
      code: voucher.code,
      statut: voucher.status,
      forfait: voucher.planName ?? '',
      routeur: voucher.routerName ?? '',
      creeLe: voucher.createdAt,
      activeLe: voucher.activatedAt ?? '',
      expireLe: voucher.expiresAt ?? '',
    }));

    const header = Object.keys(exportRows[0] ?? {
      code: '',
      statut: '',
      forfait: '',
      routeur: '',
      creeLe: '',
      activeLe: '',
      expireLe: '',
    });

    const lines = [
      header.join(';'),
      ...exportRows.map((row) =>
        header
          .map((key) => `"${String(row[key as keyof typeof row] ?? '').replace(/"/g, '""')}"`)
          .join(';'),
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

  const toggleSelected = (voucherId: string) => {
    setSelectedIds((current) =>
      current.includes(voucherId)
        ? current.filter((id) => id !== voucherId)
        : [...current, voucherId],
    );
  };

  const toggleSelectPage = () => {
    const pageIds = vouchers.map((voucher) => voucher.id);
    const isEntirePageSelected = pageIds.every((id) => selectedIds.includes(id));

    if (isEntirePageSelected) {
      setSelectedIds((current) => current.filter((id) => !pageIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])));
  };

  const handleBulkDelete = () => {
    if (!canDeleteTickets || selectedIds.length === 0 || bulkDeleteMutation.isPending) {
      return;
    }
    setShowBulkDeleteConfirm(true);
  };

  if (isMeLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canViewTickets) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <Ticket className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Acces limite</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ton profil ne permet pas de consulter les tickets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestion terrain des lots, des statuts d’usage, et des suppressions sûres.
          </p>
        </div>
        <Link
          href="/vouchers/generate"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          <Layers className="h-4 w-4" />
          Générer des tickets
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Rechercher un ticket"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  setPage(1);
                  setStatusFilter(item.value);
                }}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  statusFilter === item.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:bg-muted',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {USAGE_FILTERS.map((item) => (
            <button
              key={item.value}
              onClick={() => {
                setPage(1);
                setUsageFilter(item.value);
              }}
              className={clsx(
                'rounded-full border px-3 py-1.5 text-xs transition-colors',
                usageFilter === item.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'hover:bg-muted',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {selectedIds.length} ticket{selectedIds.length !== 1 ? 's' : ''} sélectionné{selectedIds.length !== 1 ? 's' : ''} · {total} au total
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleSelectPage}
            disabled={vouchers.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <CheckSquare className="h-4 w-4" />
            {allPageSelected ? 'Désélectionner la page' : 'Sélectionner la page'}
          </button>
          <button
            onClick={() => {
              setSelectedIds([]);
              setBulkDeleteSummary(null);
            }}
            disabled={selectedIds.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            Effacer la sélection
          </button>
          <button
            onClick={handleDownloadCsv}
            disabled={vouchers.length === 0 || !canExportTickets}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={selectedIds.length === 0 || !canExportTickets}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={selectedIds.length === 0 || bulkDeleteMutation.isPending || !canDeleteTickets}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer la sélection
          </button>
        </div>
      </div>

      {(!canDeleteTickets || !canExportTickets) && (
        <div className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          {!canDeleteTickets && !canExportTickets && "Ton profil permet la consultation des tickets, sans export ni suppression."}
          {!canDeleteTickets && canExportTickets && "Ton profil permet l’export, mais pas la suppression des tickets."}
          {canDeleteTickets && !canExportTickets && "Ton profil permet la suppression sûre, mais pas l’export des tickets."}
        </div>
      )}

      {bulkDeleteSummary && (
        <div className="rounded-xl border bg-card px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              {bulkDeleteSummary.deletedCount} supprimé{bulkDeleteSummary.deletedCount !== 1 ? 's' : ''}
            </span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              {bulkDeleteSummary.skippedCount} conservé{bulkDeleteSummary.skippedCount !== 1 ? 's' : ''}
            </span>
            <p className="text-sm text-muted-foreground">
              Les tickets deja utilises, actifs, expires ou proteges ne sont pas supprimes.
            </p>
          </div>
          {bulkDeleteSummary.skipped.length > 0 && (
            <div className="mt-3 space-y-2">
              {bulkDeleteSummary.skipped.slice(0, 6).map((item) => (
                <div
                  key={`${item.voucherId}-${item.code ?? 'missing'}`}
                  className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                >
                  <p className="font-medium">{item.code ?? item.voucherId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                </div>
              ))}
              {bulkDeleteSummary.skipped.length > 6 && (
                <p className="text-xs text-muted-foreground">
                  {bulkDeleteSummary.skipped.length - 6} autre(s) ticket(s) conserve(s).
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="p-12 text-center">
            <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-medium">Aucun ticket</p>
            <p className="text-muted-foreground text-sm mt-1">
              Ajuste les filtres ou génère un nouveau lot.
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {['', 'Ticket', 'Forfait', 'Première connexion', 'Fin prévue', 'Statut', ''].map((heading) => (
                    <th key={heading} className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vouchers.map((voucher) => {
                  const cfg = STATUS_CFG[voucher.status] ?? STATUS_CFG.EXPIRED;
                  const Icon = cfg.icon;
                  return (
                    <tr key={voucher.id} className="hover:bg-muted/20 transition-colors align-top">
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(voucher.id)}
                          onChange={() => toggleSelected(voucher.id)}
                          className="h-4 w-4 rounded border-border"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-mono text-sm font-bold tracking-widest text-primary">{voucher.code}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {voucher.routerName ?? 'Sans routeur'} · {voucher.generationType === 'MANUAL' ? 'Lot manuel' : 'Auto'}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm">{voucher.planName ?? '—'}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Créé {formatDistanceToNow(new Date(voucher.createdAt), { addSuffix: true, locale: fr })}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm">{formatDate(voucher.activatedAt)}</p>
                        {!voucher.activatedAt && (
                          <p className="mt-1 text-[11px] text-muted-foreground">Jamais utilisé</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm">{formatDate(voucher.expiresAt)}</p>
                        {voucher.expiresAt && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(voucher.expiresAt), { addSuffix: true, locale: fr })}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={clsx('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium', cfg.bg, cfg.color)}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                        {voucher.lastDeliveryError && (
                          <p className="mt-2 max-w-56 text-[11px] text-orange-400" title={voucher.lastDeliveryError}>
                            {voucher.lastDeliveryError}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {['GENERATED', 'DELIVERY_FAILED'].includes(voucher.status) && (
                            <button
                              onClick={() => redeliverMutation.mutate(voucher.id)}
                              disabled={redeliverMutation.isPending || !canUpdateTickets}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs hover:bg-muted transition-colors disabled:opacity-50"
                              title={voucher.lastDeliveryError ?? 'Relancer la livraison vers le routeur'}
                            >
                              <RefreshCw className="h-3 w-3" />
                              Relivrer
                            </button>
                          )}
                          {['GENERATED', 'DELIVERED', 'ACTIVE', 'DELIVERY_FAILED'].includes(voucher.status) && (
                            <button
                              onClick={() => revokeMutation.mutate(voucher.id)}
                              disabled={revokeMutation.isPending || !canUpdateTickets}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                            >
                              <Ban className="h-3 w-3" />
                              Révoquer
                            </button>
                          )}
                          {safeToDelete(voucher) && (
                            <button
                              onClick={() => setConfirmDeleteVoucherId(voucher.id)}
                              disabled={deleteMutation.isPending || !canDeleteTickets}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs hover:bg-muted transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Supprimer
                            </button>
                          )}
                        </div>
                        {safeToDelete(voucher) ? (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Suppression autorisée tant que le ticket n’a jamais été utilisé.
                          </p>
                        ) : (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Historique conservé pour les tickets déjà consommés.
                          </p>
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
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border hover:bg-muted transition-colors disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
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

      <ConfirmDialog
        open={showBulkDeleteConfirm}
        title={`Supprimer ${selectedIds.length} ticket(s) ?`}
        description="Les tickets déjà utilisés ou protégés seront conservés automatiquement. Seuls les tickets jamais servis seront supprimés."
        confirmLabel="Supprimer la sélection"
        isLoading={bulkDeleteMutation.isPending}
        onConfirm={() => {
          setShowBulkDeleteConfirm(false);
          setBulkDeleteSummary(null);
          bulkDeleteMutation.mutate(selectedIds);
        }}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

      {confirmDeleteVoucherId && (() => {
        const voucher = vouchers.find((v) => v.id === confirmDeleteVoucherId);
        return (
          <ConfirmDialog
            open={true}
            title={`Supprimer le ticket ${voucher?.code ?? ''} ?`}
            description="Cette action est réservée aux tickets jamais utilisés."
            confirmLabel="Supprimer définitivement"
            isLoading={deleteMutation.isPending}
            onConfirm={() => {
              deleteMutation.mutate(confirmDeleteVoucherId);
              setConfirmDeleteVoucherId(null);
            }}
            onCancel={() => setConfirmDeleteVoucherId(null)}
          />
        );
      })()}
    </div>
  );
}
