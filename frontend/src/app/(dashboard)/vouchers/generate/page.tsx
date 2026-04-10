'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Printer,
  Ticket,
} from 'lucide-react';

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

const COUNT_PRESETS = [1, 10, 25, 50, 100];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}j`;
}

export default function GenerateVouchersPage() {
  const [planId, setPlanId] = useState('');
  const [routerId, setRouterId] = useState('');
  const [count, setCount] = useState(10);
  const [businessName, setBusinessName] = useState('MikroServer WiFi');
  const [generated, setGenerated] = useState<GeneratedVoucher[]>([]);
  const [success, setSuccess] = useState(false);
  const [showScreenTickets, setShowScreenTickets] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
  const canViewPlans = hasPermission(currentUser, 'plans.view');
  const canViewRouters = hasPermission(currentUser, 'routers.view');
  const canViewSettings = hasPermission(currentUser, 'settings.view');

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

  const plans = useMemo<Plan[]>(
    () => ((plansData?.data?.data as Plan[]) ?? []),
    [plansData],
  );
  const routers = useMemo<Router[]>(
    () =>
      (((routersData?.data?.data as Router[]) ?? []).filter(
        (router) => router.status === 'ONLINE' || router.status === 'DEGRADED',
      ) as Router[]),
    [routersData],
  );
  const settings = useMemo<Record<string, { value: string }>>(
    () => ((settingsData?.data?.data as Record<string, { value: string }>) ?? {}),
    [settingsData],
  );
  const selectedPlan = plans.find((plan) => plan.id === planId);
  const selectedRouter = routers.find((router) => router.id === routerId);

  useEffect(() => {
    if (!Object.keys(settings).length) return;
    setIncludeQrCode((settings['ticket.show_qr_code']?.value ?? 'false').toLowerCase() === 'true');
    const configuredTicketsPerPage = parseInt(settings['ticket.pdf_tickets_per_page']?.value ?? '50', 10);
    if ([10, 25, 50].includes(configuredTicketsPerPage)) {
      setPdfTicketsPerPage(configuredTicketsPerPage);
    }
    const configuredBusinessName = settings['ticket.enterprise_name']?.value?.trim();
    if (configuredBusinessName) {
      setBusinessName((current) =>
        current === 'MikroServer WiFi' ? configuredBusinessName : current,
      );
    }
  }, [settings]);

  const downloadPdf = async (vouchers: GeneratedVoucher[]) => {
    if (!vouchers.length) return;
    const response = await api.vouchers.downloadPdf(
      vouchers.map((voucher) => voucher.id),
      businessName,
      { includeQrCode, ticketsPerPage: includeQrCode ? 10 : pdfTicketsPerPage },
    );
    const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tickets-${Date.now()}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const generateMutation = useMutation({
    mutationFn: () => {
      const s = selectedPlan?.ticketSettings;
      return api.vouchers.generateBulk({
        planId,
        routerId,
        count,
        codeLength: s?.ticketCodeLength,
        ticketPrefix: s?.ticketPrefix,
        ticketType: s?.ticketType,
        numericOnly: s?.ticketNumericOnly,
        passwordLength: s?.ticketPasswordLength,
        passwordNumericOnly: s?.ticketPasswordNumericOnly,
      });
    },
    onSuccess: async (response) => {
      const vouchers = (response?.data?.data as GeneratedVoucher[]) ?? [];
      setGenerated(vouchers);
      setSuccess(true);
      setShowScreenTickets(outputMode !== 'PDF');
      if (outputMode !== 'SCREEN') {
        await downloadPdf(vouchers);
      }
    },
  });

  const handleManualPdfDownload = () => downloadPdf(generated);

  const canGenerate = canCreateTickets && planId && routerId && count >= 1 && count <= 500;

  if (isMeLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canCreateTickets) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <Ticket className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Accès limité</h1>
        <p className="mt-2 text-sm text-muted-foreground">Votre profil ne permet pas de générer des tickets.</p>
      </div>
    );
  }

  if (!canViewPlans || !canViewRouters) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Permissions incomplètes</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La génération de tickets requiert aussi l&apos;accès en lecture aux forfaits et aux routeurs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Ticket className="h-6 w-6 text-primary" />
          Générer des tickets
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Choisissez le forfait, le routeur et la quantité — c&apos;est tout.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-5">
        {/* Step 1: Quantity */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Combien de tickets ?
          </label>
          <div className="grid grid-cols-5 gap-2">
            {COUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setCount(preset)}
                className={`rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  count === preset
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
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
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Autre quantité (max 500)"
          />
        </div>

        {/* Step 2: Router */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Quel hotspot / routeur ?
          </label>
          {routers.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground text-center">
              Aucun routeur en ligne
            </div>
          ) : (
            <div className="grid gap-2">
              {routers.map((router) => (
                <button
                  key={router.id}
                  onClick={() => setRouterId(router.id)}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors text-left ${
                    routerId === router.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span>{router.name}</span>
                  {router.status === 'DEGRADED' && (
                    <span className="text-xs text-orange-500 font-normal">dégradé</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 3: Plan */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Quel forfait internet ?
          </label>
          {plans.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground text-center">
              Aucun forfait configuré
            </div>
          ) : (
            <div className="grid gap-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setPlanId(plan.id)}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors text-left ${
                    planId === plan.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span>{plan.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {plan.priceXof.toLocaleString('fr-CI')} FCFA · {formatDuration(plan.durationMinutes)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {selectedPlan && selectedRouter && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
            <span className="font-medium">{count} ticket{count > 1 ? 's' : ''}</span>
            {' · '}
            <span>{selectedPlan.name}</span>
            {' · '}
            <span>{selectedRouter.name}</span>
          </div>
        )}

        {/* Advanced settings (collapsed) */}
        <div className="border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span className="text-muted-foreground">Paramètres avancés</span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showAdvanced && (
            <div className="border-t bg-muted/10 px-4 py-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Sortie</label>
                  <select
                    value={outputMode}
                    onChange={(e) => setOutputMode(e.target.value as OutputMode)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="SCREEN_AND_PDF">Écran + PDF</option>
                    <option value="SCREEN">Écran seulement</option>
                    <option value="PDF">PDF direct</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeQrCode}
                    onChange={(e) => setIncludeQrCode(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  QR code sur le PDF
                </label>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tickets par feuille</label>
                  <select
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
                <label className="text-xs font-medium text-muted-foreground">Nom sur le PDF</label>
                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setSuccess(false);
            generateMutation.mutate();
          }}
          disabled={!canGenerate || generateMutation.isPending}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {generateMutation.isPending
            ? `Génération en cours (${count} tickets)…`
            : `Générer ${count} ticket${count > 1 ? 's' : ''}`}
        </button>

        {generateMutation.isError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Erreur lors de la génération. Vérifiez que le routeur est accessible.
          </div>
        )}
      </div>

      {/* Results */}
      {success && generated.length > 0 && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">
              {generated.length} ticket{generated.length > 1 ? 's' : ''} générés avec succès
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleManualPdfDownload}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Télécharger le PDF
            </button>
            <button
              onClick={handleManualPdfDownload}
              className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </button>
            <button
              onClick={() => setShowScreenTickets((v) => !v)}
              className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50"
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
                {generated.slice(0, 10).map((voucher) => (
                  <tr key={voucher.id} className="font-mono">
                    <td className="px-3 py-1.5 font-semibold text-primary">{voucher.code}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{voucher.passwordPlain}</td>
                    <td className="px-3 py-1.5">{voucher.plan?.name}</td>
                    <td className="px-3 py-1.5">{voucher.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {generated.length > 10 && (
              <div className="border-t py-2 text-center text-xs text-muted-foreground">
                + {generated.length - 10} ticket(s) supplémentaires dans le PDF
              </div>
            )}
          </div>

          {showScreenTickets && (
            <div className="grid gap-4 md:grid-cols-2">
              {generated.slice(0, 12).map((voucher, index) => {
                const sameCredential = voucher.code === voucher.passwordPlain;
                return (
                  <article
                    key={voucher.id}
                    className="rounded-2xl border bg-[linear-gradient(180deg,#fff9eb_0%,#fffdf8_100%)] p-5 shadow-sm"
                  >
                    <p className="text-center text-xs font-semibold tracking-[0.2em] text-muted-foreground">
                      #{index + 1}
                    </p>
                    <div className="mt-3 rounded-xl border-2 border-slate-900 bg-white px-4 py-4 text-center">
                      {sameCredential ? (
                        <p className="break-all font-mono text-2xl font-bold text-slate-900">
                          {voucher.code}
                        </p>
                      ) : (
                        <div className="space-y-2 text-left text-sm">
                          <p>
                            <span className="font-semibold">User:</span>{' '}
                            <span className="font-mono">{voucher.code}</span>
                          </p>
                          <p>
                            <span className="font-semibold">Mot de passe:</span>{' '}
                            <span className="font-mono">{voucher.passwordPlain}</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="mt-4 text-center text-xl font-semibold">
                      {voucher.plan.priceXof.toLocaleString('fr-CI')} FCFA
                    </p>
                    <p className="mt-1 text-center text-sm font-medium">
                      {selectedRouter?.name ?? voucher.plan.name}
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
  );
}
