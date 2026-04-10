'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Store, Wallet, TrendingUp, Ticket, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { resellersApi, ResellerVoucher, GenerateVouchersResult } from '@/lib/api/resellers';
import { plansApi } from '@/lib/api/plans';
import { unwrap, apiError } from '@/lib/api/client';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  priceXof: number;
  durationMinutes: number;
  status: string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  GENERATED: 'Généré',
  DELIVERED: 'Livré',
  ACTIVE: 'Utilisé',
  EXPIRED: 'Expiré',
  REVOKED: 'Révoqué',
  DELIVERY_FAILED: 'Échec',
};

const STATUS_COLORS: Record<string, string> = {
  GENERATED: 'bg-blue-500/15 text-blue-400',
  DELIVERED: 'bg-purple-500/15 text-purple-400',
  ACTIVE: 'bg-green-500/15 text-green-400',
  EXPIRED: 'bg-yellow-500/15 text-yellow-500',
  REVOKED: 'bg-red-500/15 text-red-400',
  DELIVERY_FAILED: 'bg-red-500/15 text-red-400',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 flex items-start gap-4">
      <div className={clsx('rounded-xl p-2.5', color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-bold">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Generated vouchers result modal ─────────────────────────────────────────

function GeneratedVouchersModal({
  result,
  onClose,
}: {
  result: GenerateVouchersResult;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-[24px] border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="h-6 w-6 text-green-400" />
          <h2 className="text-lg font-semibold">
            {result.vouchers.length} voucher{result.vouchers.length > 1 ? 's' : ''} généré
            {result.vouchers.length > 1 ? 's' : ''}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Montant débité : <span className="font-semibold text-foreground">{result.deducted.toLocaleString('fr-FR')} FCFA</span>.
          Conservez ces codes — le mot de passe ne sera plus affiché.
        </p>
        <div className="max-h-64 overflow-y-auto rounded-xl border divide-y divide-border">
          {result.vouchers.map((v) => (
            <div key={v.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="font-mono font-medium">{v.code}</span>
              <span className="text-muted-foreground font-mono text-xs">mdp: {v.passwordPlain}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResellerPage() {
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<GenerateVouchersResult | null>(null);

  // Stats
  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['reseller-me'],
    queryFn: () => resellersApi.getMyStats(),
    staleTime: 30_000,
  });

  const stats = (statsData as any)?.data?.data;

  // Plans
  const { data: plansData } = useQuery({
    queryKey: ['plans-public'],
    queryFn: () => plansApi.publicList(),
    staleTime: 5 * 60_000,
  });
  const plans: Plan[] = ((plansData as any)?.data?.data ?? []).filter(
    (p: Plan) => p.status === 'ACTIVE',
  );

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const estimatedCost = selectedPlan ? selectedPlan.priceXof * quantity : 0;
  const canAfford = stats ? stats.creditBalance >= estimatedCost : false;

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: () => resellersApi.generateVouchers(selectedPlanId, quantity),
    onSuccess: (res) => {
      const result = (res as any)?.data?.data as GenerateVouchersResult;
      setGenerateResult(result);
      setGenerateError(null);
      void queryClient.invalidateQueries({ queryKey: ['reseller-me'] });
    },
    onError: (err) => {
      setGenerateError(apiError(err, 'Impossible de générer les vouchers.'));
    },
  });

  const handleGenerate = () => {
    if (!selectedPlanId) {
      setGenerateError('Veuillez sélectionner un forfait.');
      return;
    }
    if (quantity < 1 || quantity > 50) {
      setGenerateError('La quantité doit être comprise entre 1 et 50.');
      return;
    }
    if (!canAfford) {
      setGenerateError('Solde insuffisant pour cette commande.');
      return;
    }
    setGenerateError(null);
    generateMutation.mutate();
  };

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (statsLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-[28px] border bg-card/70" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border bg-card/70" />
          ))}
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="rounded-[28px] border bg-card p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold">Impossible de charger vos données</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {apiError(statsError, 'Une erreur est survenue. Réessayez plus tard.')}
        </p>
      </div>
    );
  }

  return (
    <>
      {generateResult && (
        <GeneratedVouchersModal
          result={generateResult}
          onClose={() => setGenerateResult(null)}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-[28px] border bg-card p-6 flex items-center gap-4">
          <div className="rounded-2xl bg-primary/15 p-3">
            <Store className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Mon espace revendeur</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gérez votre crédit et générez des vouchers WiFi pour vos clients.
            </p>
          </div>
          {stats && !stats.isActive && (
            <div className="ml-auto flex items-center gap-2 rounded-xl bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-400">
              <AlertCircle className="h-4 w-4" />
              Compte inactif
            </div>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Solde crédit"
            value={`${(stats?.creditBalance ?? 0).toLocaleString('fr-FR')} FCFA`}
            sub="Disponible pour acheter des vouchers"
            icon={Wallet}
            color="bg-primary/15 text-primary"
          />
          <StatCard
            label="Taux de commission"
            value={`${Number(stats?.commissionRate ?? 0).toFixed(1)} %`}
            sub="Sur chaque vente enregistrée"
            icon={TrendingUp}
            color="bg-green-500/15 text-green-400"
          />
          <StatCard
            label="Vouchers vendus"
            value={stats?.totalSold ?? 0}
            sub={`sur ${stats?.totalGenerated ?? 0} générés`}
            icon={Ticket}
            color="bg-purple-500/15 text-purple-400"
          />
        </div>

        {/* Generate panel */}
        <div className="rounded-[24px] border bg-card p-6">
          <h2 className="text-base font-semibold mb-4">Générer des vouchers</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Plan selector */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Forfait
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">— Choisir un forfait —</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.priceXof.toLocaleString('fr-FR')} FCFA
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Quantité (1 – 50)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value))))}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Cost preview */}
          {selectedPlan && (
            <div className="mt-4 rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {quantity} × {selectedPlan.priceXof.toLocaleString('fr-FR')} FCFA
              </span>
              <span
                className={clsx(
                  'font-semibold',
                  canAfford ? 'text-foreground' : 'text-destructive',
                )}
              >
                = {estimatedCost.toLocaleString('fr-FR')} FCFA
                {!canAfford && (
                  <span className="ml-2 text-xs font-normal">(solde insuffisant)</span>
                )}
              </span>
            </div>
          )}

          {/* Error */}
          {generateError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {generateError}
            </div>
          )}

          {/* Action */}
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !stats?.isActive}
            className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generateMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
            Générer
          </button>
        </div>

        {/* Recent vouchers table */}
        <div className="rounded-[24px] border bg-card">
          <div className="px-6 py-4 border-b">
            <h2 className="text-base font-semibold">Mes derniers vouchers</h2>
          </div>

          {!stats?.recentVouchers?.length ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucun voucher généré pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Code
                    </th>
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Forfait
                    </th>
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Prix
                    </th>
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(stats.recentVouchers as ResellerVoucher[]).map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3 font-mono font-medium">{v.code}</td>
                      <td className="px-6 py-3 text-muted-foreground">{v.plan?.name}</td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {v.plan?.priceXof?.toLocaleString('fr-FR')} FCFA
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {new Date(v.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
