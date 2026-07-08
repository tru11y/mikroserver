'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import type { AxiosError } from 'axios';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Layers,
  Loader2,
  Printer,
  Ticket,
} from 'lucide-react';
import { VouchersTabs } from '../vouchers-tabs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PriceLabel } from '@/components/ui/price-label';

type TicketType = 'PIN' | 'USER_PASSWORD';
type OutputMode = 'SCREEN' | 'PDF' | 'SCREEN_AND_PDF';

interface PlanTicketSettings {
  ticketType: TicketType;
  durationMode: 'ELAPSED' | 'PAUSED';
  ticketPrefix: string;
  ticketCodeLength: number;
  ticketNumericOnly: boolean;
  ticketPasswordLength: number;
  ticketPasswordNumericOnly: boolean;
  usersPerTicket: number;
}

interface Plan {
  id: string;
  name: string;
  priceXof: number;
  durationMinutes: number;
  ticketSettings: PlanTicketSettings;
}

interface Router {
  id: string;
  name: string;
  status: string;
}

interface GeneratedVoucher {
  id: string;
  code: string;
  passwordPlain: string;
  status: string;
  plan: { name: string; priceXof: number; durationMinutes: number };
}

interface AsyncBatchResponse {
  async: true;
  batchId: string;
  batchNumber: number;
  quantity: number;
  status: 'PENDING';
}

interface SyncBatchResponse {
  async: false;
  batchId: string;
  batchNumber: number;
  vouchers: GeneratedVoucher[];
}

type GenerateBulkResponse = AsyncBatchResponse | SyncBatchResponse;

interface BatchStatus {
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  generated: number;
  quantity: number;
  batchNumber: number;
}

const COUNT_PRESETS = [1, 10, 25, 50, 100];
const CONFIRM_THRESHOLD = 50;

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}j`;
}

type ApiError = AxiosError<{ message?: string }>;

export default function GenerateVouchersPage() {
  const router = useRouter();
  const [planId, setPlanId] = useState('');
  const [routerId, setRouterId] = useState('');
  const [count, setCount] = useState(10);
  const [businessName, setBusinessName] = useState('MikroServer WiFi');
  const [generated, setGenerated] = useState<GeneratedVoucher[]>([]);
  const [success, setSuccess] = useState(false);
  const [asyncBatchId, setAsyncBatchId] = useState<string | null>(null);
  const [asyncBatchNumber, setAsyncBatchNumber] = useState<number | null>(null);
  const [showScreenTickets, setShowScreenTickets] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [outputMode, setOutputMode] = useState<OutputMode>('SCREEN_AND_PDF');
  const [includeQrCode, setIncludeQrCode] = useState(false);
  const [pdfTicketsPerPage, setPdfTicketsPerPage] = useState(50);

  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canCreateTickets = hasPermission(currentUser, 'tickets.create');
  const canViewPlans     = hasPermission(currentUser, 'plans.view');
  const canViewRouters   = hasPermission(currentUser, 'routers.view');
  const canViewSettings  = hasPermission(currentUser, 'settings.view');

  const { data: plansData } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.plans.list(),
    enabled: canViewPlans,
  });

  const { data: routersData } = useQuery({
    queryKey: ['routers', 'list'],
    queryFn: () => api.routers.list(),
    enabled: canViewRouters,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings.get(),
    enabled: canViewSettings,
  });

  const plans = useMemo<Plan[]>(() => ((plansData?.data?.data as Plan[]) ?? []), [plansData]);
  const routers = useMemo<Router[]>(
    () =>
      ((routersData?.data?.data as Router[]) ?? []).filter(
        (r) => r.status === 'ONLINE' || r.status === 'DEGRADED',
      ),
    [routersData],
  );
  const settings = useMemo<Record<string, { value: string }>>(
    () => ((settingsData?.data?.data as Record<string, { value: string }>) ?? {}),
    [settingsData],
  );

  const selectedPlan   = plans.find((p) => p.id === planId);
  const selectedRouter = routers.find((r) => r.id === routerId);

  useEffect(() => {
    if (!Object.keys(settings).length) return;
    setIncludeQrCode((settings['ticket.show_qr_code']?.value ?? 'false').toLowerCase() === 'true');
    const perPage = parseInt(settings['ticket.pdf_tickets_per_page']?.value ?? '50', 10);
    if ([10, 25, 50].includes(perPage)) setPdfTicketsPerPage(perPage);
    const name = settings['ticket.enterprise_name']?.value?.trim();
    if (name) setBusinessName((cur) => (cur === 'MikroServer WiFi' ? name : cur));
  }, [settings]);

  const downloadPdf = async (vouchers: GeneratedVoucher[]) => {
    if (!vouchers.length) return;
    const response = await api.vouchers.downloadPdf(
      vouchers.map((v) => v.id),
      businessName,
      { includeQrCode, ticketsPerPage: includeQrCode ? 10 : pdfTicketsPerPage },
    );
    const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Polling for async batch progress
  const { data: batchStatusData } = useQuery({
    queryKey: ['batch-status', asyncBatchId],
    queryFn: () => api.vouchers.getBatch(asyncBatchId!),
    enabled: !!asyncBatchId,
    refetchInterval: (query) => {
      const batchStatus = query.state.data
        ? unwrap<BatchStatus>(query.state.data as never)
        : null;
      if (!batchStatus) return 3000;
      return batchStatus.status === 'PENDING' || batchStatus.status === 'GENERATING'
        ? 3000
        : false;
    },
  });

  const batchStatus = batchStatusData ? unwrap<BatchStatus>(batchStatusData) : null;

  const generateMutation = useMutation({
    mutationFn: () => {
      const s = selectedPlan?.ticketSettings;
      return api.vouchers.generateBulk({
        planId, routerId, count,
        codeLength: s?.ticketCodeLength,
        ticketPrefix: s?.ticketPrefix,
        ticketType: s?.ticketType,
        numericOnly: s?.ticketNumericOnly,
        passwordLength: s?.ticketPasswordLength,
        passwordNumericOnly: s?.ticketPasswordNumericOnly,
      });
    },
    onSuccess: async (response) => {
      const result = response?.data?.data as GenerateBulkResponse | null;
      if (!result) return;

      if (result.async) {
        // Large batch — show async progress UI
        setAsyncBatchId(result.batchId);
        setAsyncBatchNumber(result.batchNumber);
        setSuccess(true);
        setGenerated([]);
        return;
      }

      // Sync path — show tickets immediately
      setAsyncBatchId(null);
      const vouchers = (result as SyncBatchResponse).vouchers ?? [];
      setGenerated(vouchers);
      setSuccess(true);
      setShowScreenTickets(outputMode !== 'PDF');
      if (outputMode !== 'SCREEN') await downloadPdf(vouchers);
    },
  });

  const handleGenerateClick = () => {
    setSuccess(false);
    if (count > CONFIRM_THRESHOLD) {
      setShowConfirm(true);
    } else {
      generateMutation.mutate();
    }
  };

  const canGenerate = canCreateTickets && planId && routerId && count >= 1 && count <= 500;

  if (isMeLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!canCreateTickets) {
    return (
      <div className="space-y-4">
        <VouchersTabs permissions={{ canView: true, canCreate: false, canVerify: false }} />
        <div className="rounded-lg border bg-card p-8 text-center">
          <Ticket className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <h1 className="mt-3 text-base font-semibold">Accès limité</h1>
          <p className="mt-1 text-xs text-muted-foreground">Votre profil ne permet pas de générer des tickets.</p>
        </div>
      </div>
    );
  }

  if (!canViewPlans || !canViewRouters) {
    return (
      <div className="space-y-4">
        <VouchersTabs permissions={{ canView: true, canCreate: canCreateTickets, canVerify: false }} />
        <div className="rounded-lg border bg-card p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <h1 className="mt-3 text-base font-semibold">Permissions incomplètes</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            La génération de tickets requiert aussi l&apos;accès en lecture aux forfaits et aux routeurs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <VouchersTabs permissions={{ canView: true, canCreate: canCreateTickets, canVerify: false }} />
      <div className="max-w-2xl space-y-5">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Ticket className="h-4 w-4 text-primary" />
            Générer des tickets
          </h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Choisissez le forfait, le routeur et la quantité.
          </p>
        </div>

        <div className="space-y-5 rounded-xl border bg-card p-6">
          {/* Quantité */}
          <div className="space-y-2">
            <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Combien de tickets ?
            </label>
            <div className="grid grid-cols-5 gap-2">
              {COUNT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCount(preset)}
                  className={`rounded-xl border py-3 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    count === preset ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))}
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              placeholder="Autre quantité (max 500)"
            />
          </div>

          {/* Routeur */}
          <div className="space-y-2">
            <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Quel hotspot / routeur ?
            </label>
            {routers.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-center text-sm text-muted-foreground">
                Aucun routeur en ligne
              </div>
            ) : (
              <div className="grid gap-2">
                {routers.map((router) => (
                  <button
                    key={router.id}
                    type="button"
                    onClick={() => setRouterId(router.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      routerId === router.id ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
                    }`}
                  >
                    <span>{router.name}</span>
                    {router.status === 'DEGRADED' && (
                      <span className="text-xs font-normal text-warning">dégradé</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Forfait */}
          <div className="space-y-2">
            <label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Quel forfait internet ?
            </label>
            {plans.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-center text-sm text-muted-foreground">
                Aucun forfait configuré
              </div>
            ) : (
              <div className="grid gap-2">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setPlanId(plan.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      planId === plan.id ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
                    }`}
                  >
                    <span>{plan.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      <PriceLabel amount={plan.priceXof} /> · {formatDuration(plan.durationMinutes)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Récap */}
          {selectedPlan && selectedRouter && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <span className="font-medium">{count} ticket{count > 1 ? 's' : ''}</span>
              {' · '}
              <span>{selectedPlan.name}</span>
              {' · '}
              <span>{selectedRouter.name}</span>
            </div>
          )}

          {/* Paramètres avancés */}
          <div className="overflow-hidden rounded-xl border">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-all duration-200 ease-out hover:bg-muted/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="text-muted-foreground">Paramètres avancés</span>
              {showAdvanced
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />
              }
            </button>
            {showAdvanced && (
              <div className="space-y-4 border-t bg-muted/10 px-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="output-mode" className="text-xs font-medium text-muted-foreground">Sortie</label>
                    <select
                      id="output-mode"
                      value={outputMode}
                      onChange={(e) => setOutputMode(e.target.value as OutputMode)}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <option value="SCREEN_AND_PDF">Écran + PDF</option>
                      <option value="SCREEN">Écran seulement</option>
                      <option value="PDF">PDF direct</option>
                    </select>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={includeQrCode}
                      onChange={(e) => setIncludeQrCode(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    QR code sur le PDF
                  </label>
                  <div className="space-y-1.5">
                    <label htmlFor="tickets-per-page" className="text-xs font-medium text-muted-foreground">Tickets par feuille</label>
                    <select
                      id="tickets-per-page"
                      value={String(includeQrCode ? 10 : pdfTicketsPerPage)}
                      onChange={(e) => setPdfTicketsPerPage(parseInt(e.target.value, 10))}
                      disabled={includeQrCode}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                    >
                      <option value="10">10 (détaillé)</option>
                      <option value="25">25</option>
                      <option value="50">50 (terrain)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="business-name" className="text-xs font-medium text-muted-foreground">Nom sur le PDF</label>
                  <input
                    id="business-name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={!canGenerate || generateMutation.isPending}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-all duration-200 ease-out hover:bg-primary/90 hover:shadow-[var(--shadow-glow)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
          >
            {generateMutation.isPending
              ? `Génération en cours (${count} tickets)…`
              : `Générer ${count} ticket${count > 1 ? 's' : ''}`}
          </button>

          {generateMutation.isError && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {(generateMutation.error as ApiError)?.response?.data?.message ??
                'Erreur lors de la génération. Vérifiez que le routeur est accessible.'}
            </div>
          )}
        </div>

        {/* Résultats async (grand lot en cours) */}
        {success && asyncBatchId && (
          <div className="space-y-4 rounded-xl border bg-card p-6">
            {batchStatus?.status === 'COMPLETED' ? (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">
                  Lot #{asyncBatchNumber} — {batchStatus.quantity} tickets générés
                </span>
              </div>
            ) : batchStatus?.status === 'FAILED' ? (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold">Échec de la génération du lot #{asyncBatchNumber}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-semibold">
                  Lot #{asyncBatchNumber ?? '...'} en cours — {batchStatus?.generated ?? 0}/{batchStatus?.quantity ?? count} tickets
                </span>
              </div>
            )}

            {batchStatus && batchStatus.quantity > 0 && batchStatus.status !== 'COMPLETED' && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.round((batchStatus.generated / batchStatus.quantity) * 100)}%` }}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => router.push('/vouchers/lots')}
              className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ease-out hover:bg-muted/50 active:scale-[0.98]"
            >
              <Layers className="h-4 w-4" />
              Voir tous les lots
            </button>
          </div>
        )}

        {/* Résultats sync */}
        {success && !asyncBatchId && generated.length > 0 && (
          <div className="space-y-4 rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">
                {generated.length} ticket{generated.length > 1 ? 's' : ''} générés avec succès
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => downloadPdf(generated)}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-200 ease-out hover:bg-primary/90 hover:shadow-[var(--shadow-glow)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Télécharger le PDF
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ease-out hover:bg-muted/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Imprimer
              </button>
              <button
                type="button"
                onClick={() => setShowScreenTickets((v) => !v)}
                className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ease-out hover:bg-muted/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Eye className="h-4 w-4" />
                {showScreenTickets ? 'Masquer' : 'Afficher les tickets'}
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border text-xs">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mot de passe</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Forfait</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {generated.slice(0, 10).map((v) => (
                    <tr key={v.id} className="font-mono">
                      <td className="px-3 py-1.5 font-semibold text-primary">{v.code}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{v.passwordPlain}</td>
                      <td className="px-3 py-1.5">{v.plan?.name}</td>
                      <td className="px-3 py-1.5 capitalize">{v.status.toLowerCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {generated.length > 10 && (
                <div className="border-t py-2 text-center text-xs text-muted-foreground">
                  +{generated.length - 10} ticket(s) supplémentaires dans le PDF
                </div>
              )}
            </div>

            {showScreenTickets && (
              <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
                {generated.slice(0, 12).map((v, i) => {
                  const sameCredential = v.code === v.passwordPlain;
                  return (
                    <article
                      key={v.id}
                      className="rounded-2xl border bg-card p-5 shadow-sm"
                    >
                      <p className="text-center text-xs font-semibold tracking-[0.2em] text-muted-foreground">
                        #{i + 1}
                      </p>
                      <div className="mt-3 rounded-xl border-2 border-border bg-muted/30 px-4 py-4 text-center">
                        {sameCredential ? (
                          <p className="break-all font-mono text-2xl font-bold text-foreground">
                            {v.code}
                          </p>
                        ) : (
                          <div className="space-y-2 text-left text-sm">
                            <p>
                              <span className="font-semibold">User:</span>{' '}
                              <span className="font-mono">{v.code}</span>
                            </p>
                            <p>
                              <span className="font-semibold">Mot de passe:</span>{' '}
                              <span className="font-mono">{v.passwordPlain}</span>
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="mt-4 text-center text-xl font-semibold">
                        <PriceLabel amount={v.plan.priceXof} />
                      </p>
                      <p className="mt-1 text-center text-sm font-medium">
                        {selectedRouter?.name ?? v.plan.name}
                      </p>
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        1. Connectez-vous au WiFi{' '}
                        <span className="font-medium text-foreground">
                          {selectedRouter?.name ?? 'du hotspot'}
                        </span>.
                        <br />
                        2. Saisissez le code sur la page du hotspot.
                        {sameCredential ? ' Le même code sert de mot de passe.' : ''}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        title={`Générer ${count} tickets ?`}
        description={`Vous allez créer ${count} tickets${selectedPlan ? ` (${selectedPlan.name})` : ''}${selectedRouter ? ` sur ${selectedRouter.name}` : ''}. Cette opération est irréversible.`}
        confirmLabel={`Générer ${count} tickets`}
        isLoading={generateMutation.isPending}
        onConfirm={() => { setShowConfirm(false); generateMutation.mutate(); }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
