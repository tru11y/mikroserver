'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Ticket, Download, Printer, AlertCircle, CheckCircle2 } from 'lucide-react';

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

interface GeneratedVoucher {
  id: string;
  code: string;
  passwordPlain: string;
  status: string;
  plan: { name: string; priceXof: number; durationMinutes: number };
}

export default function GenerateVouchersPage() {
  const [planId, setPlanId] = useState('');
  const [routerId, setRouterId] = useState('');
  const [count, setCount] = useState(10);
  const [businessName, setBusinessName] = useState('MikroServer WiFi');
  const [generated, setGenerated] = useState<GeneratedVoucher[]>([]);
  const [success, setSuccess] = useState(false);

  const { data: plansData } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.plans.list(),
  });

  const { data: routersData } = useQuery({
    queryKey: ['routers', 'list'],
    queryFn: () => api.routers.list(),
  });

  const plans: Plan[] = (plansData?.data?.data as Plan[]) ?? [];
  const routers: Router[] = ((routersData?.data?.data as Router[]) ?? []).filter(
    (r) => r.status === 'ONLINE',
  );

  const generateMutation = useMutation({
    mutationFn: () =>
      api.vouchers.generateBulk({ planId, routerId, count }),
    onSuccess: (res) => {
      setGenerated((res?.data?.data as GeneratedVoucher[]) ?? []);
      setSuccess(true);
    },
  });

  const handleDownloadPdf = async () => {
    if (!generated.length) return;
    const res = await api.vouchers.downloadPdf(
      generated.map((v) => v.id),
      businessName,
    );
    const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canGenerate = planId && routerId && count >= 1 && count <= 500;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Ticket className="h-6 w-6 text-primary" />
          Générer des tickets
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Créez un lot de tickets, envoyez-les au routeur et imprimez-les.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-5">
        {/* Plan */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Forfait</label>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">-- Sélectionner un forfait --</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.priceXof.toLocaleString('fr-CI')} FCFA
              </option>
            ))}
          </select>
        </div>

        {/* Router */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Routeur cible</label>
          <select
            value={routerId}
            onChange={(e) => setRouterId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">-- Sélectionner un routeur en ligne --</option>
            {routers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {routersData && routers.length === 0 && (
            <p className="text-xs text-amber-600">Aucun routeur en ligne disponible.</p>
          )}
        </div>

        {/* Quantity */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Quantité (1 – 500)</label>
          <input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Business name for PDF */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nom affiché sur le PDF</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          onClick={() => { setSuccess(false); generateMutation.mutate(); }}
          disabled={!canGenerate || generateMutation.isPending}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {generateMutation.isPending
            ? `Génération en cours (${count} tickets)...`
            : `Générer ${count} ticket${count > 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Result */}
      {success && generated.length > 0 && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">{generated.length} tickets générés avec succès !</span>
          </div>

          <p className="text-sm text-muted-foreground">
            Les tickets ont été créés et mis en file pour livraison vers le routeur MikroTik.
            Tu peux suivre leur statut exact dans la page vouchers.
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              Télécharger le PDF
            </button>
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </button>
          </div>

          {/* Preview table */}
          <div className="rounded-lg border overflow-hidden text-xs">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Code</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Mot de passe</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Forfait</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {generated.slice(0, 10).map((v) => (
                  <tr key={v.id} className="font-mono">
                    <td className="px-3 py-1.5 text-primary font-semibold">{v.code}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{v.passwordPlain}</td>
                    <td className="px-3 py-1.5">{v.plan?.name}</td>
                    <td className="px-3 py-1.5">{v.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {generated.length > 10 && (
              <div className="text-center py-2 text-muted-foreground text-xs border-t">
                + {generated.length - 10} ticket(s) supplémentaires dans le PDF
              </div>
            )}
          </div>
        </div>
      )}

      {generateMutation.isError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Erreur lors de la génération. Vérifie que le routeur est accessible.
        </div>
      )}
    </div>
  );
}
