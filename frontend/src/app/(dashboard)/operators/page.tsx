'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Plus, RefreshCw, XCircle, Crown, Copy, Check,
  ShieldAlert, ChevronDown, Wifi, Ticket, TrendingUp,
} from 'lucide-react';
import { adminApi, Operator, SaasTier } from '@/lib/api/admin';
import { apiError } from '@/lib/api/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(xof: number) {
  return new Intl.NumberFormat('fr-FR').format(xof) + ' FCFA';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return format(new Date(iso), 'd MMM yyyy', { locale: fr });
}

const TIER_COLORS: Record<string, string> = {
  decouverte: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  entrepreneur: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  pro: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  enterprise: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

const SUB_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/15 text-green-400 border-green-500/30',
  TRIAL: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  CANCELLED: 'bg-red-500/15 text-red-400 border-red-500/30',
  EXPIRED: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  SUSPENDED: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
};

const SUB_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  TRIAL: 'Essai',
  CANCELLED: 'Résilié',
  EXPIRED: 'Expiré',
  SUSPENDED: 'Suspendu',
};

function TierBadge({ slug, name }: { slug: string | null; name: string | null }) {
  if (!name) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = TIER_COLORS[slug ?? ''] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <Crown className="h-3 w-3" />
      {name}
    </span>
  );
}

function SubStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">Aucun</span>;
  const cls = SUB_STATUS_COLORS[status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {SUB_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function AvatarInitials({ firstName, lastName }: { firstName: string; lastName: string }) {
  return (
    <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-primary">
        {(firstName[0] ?? '').toUpperCase()}{(lastName[0] ?? '').toUpperCase()}
      </span>
    </div>
  );
}

// ── Provision modal ───────────────────────────────────────────────────────────

function ProvisionModal({ tiers, onClose, onSuccess }: {
  tiers: SaasTier[];
  onClose: () => void;
  onSuccess: (password: string, email: string) => void;
}) {
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '', phone: '',
    tierId: '', billingCycle: 'MONTHLY' as 'MONTHLY' | 'YEARLY',
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => adminApi.provisionOperator({
      email: form.email,
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone || undefined,
      tierId: form.tierId || undefined,
      billingCycle: form.tierId ? form.billingCycle : undefined,
    }),
    onSuccess: (res) => {
      const d = (res.data as any)?.data;
      onSuccess(d.tempPassword, d.operator.email);
    },
    onError: (err) => setError(apiError(err)),
  });

  const activeTiers = tiers.filter(t => t.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Nouvel opérateur</h2>
            <p className="text-xs text-muted-foreground">Crée le compte et assigne un abonnement</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="jean.dupont@wifi-ci.com"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Prénom *</label>
            <input
              type="text"
              value={form.firstName}
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
              className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Jean"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nom *</label>
            <input
              type="text"
              value={form.lastName}
              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
              className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Dupont"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Téléphone</label>
            <input
              type="text"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="+2250700000000"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tier SaaS</label>
            <select
              value={form.tierId}
              onChange={e => setForm(f => ({ ...f, tierId: e.target.value }))}
              className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">— Sans abonnement —</option>
              {activeTiers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} — {fmt(t.priceXofMonthly)}/mois
                </option>
              ))}
            </select>
          </div>
          {form.tierId && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Facturation</label>
              <select
                value={form.billingCycle}
                onChange={e => setForm(f => ({ ...f, billingCycle: e.target.value as 'MONTHLY' | 'YEARLY' }))}
                className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="MONTHLY">Mensuel</option>
                <option value="YEARLY">Annuel</option>
              </select>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors">
            Annuler
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.email || !form.firstName || !form.lastName}
            className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Création...' : 'Créer l\'opérateur'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Temp password display ─────────────────────────────────────────────────────

function TempPasswordModal({ password, email, onClose }: { password: string; email: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-500/15 flex items-center justify-center">
            <Check className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Opérateur créé</h2>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>

        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
          <p className="text-xs text-green-400 font-medium mb-2">Mot de passe temporaire :</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm bg-background border rounded-lg px-3 py-2 select-all">
              {password}
            </code>
            <button onClick={copy} className="p-2 rounded-lg border hover:bg-muted transition-colors flex-shrink-0">
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-300">
            Ce mot de passe ne sera plus affiché. Transmettez-le à l'opérateur via un canal sécurisé.
          </p>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign subscription modal ─────────────────────────────────────────────────

function AssignSubModal({ operator, tiers, onClose }: {
  operator: Operator;
  tiers: SaasTier[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [tierId, setTierId] = useState('');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => adminApi.assignSubscription(operator.id, tierId, billingCycle),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['operators'] }); onClose(); },
    onError: (err) => setError(apiError(err)),
  });

  const activeTiers = tiers.filter(t => t.isActive);
  const selectedTier = activeTiers.find(t => t.id === tierId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-base">Assigner un abonnement</h2>
          <p className="text-xs text-muted-foreground">{operator.firstName} {operator.lastName} — {operator.email}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tier SaaS *</label>
            <select
              value={tierId}
              onChange={e => setTierId(e.target.value)}
              className="w-full bg-background border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">— Choisir un tier —</option>
              {activeTiers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} — {fmt(t.priceXofMonthly)}/mois
                  {t.priceXofYearly ? ` | ${fmt(t.priceXofYearly)}/an` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Facturation</label>
            <div className="flex gap-2">
              {(['MONTHLY', 'YEARLY'] as const).map(cycle => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${billingCycle === cycle ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                >
                  {cycle === 'MONTHLY' ? 'Mensuel' : 'Annuel'}
                  {selectedTier && cycle === 'MONTHLY' && ` — ${fmt(selectedTier.priceXofMonthly)}`}
                  {selectedTier && cycle === 'YEARLY' && selectedTier.priceXofYearly && ` — ${fmt(selectedTier.priceXofYearly)}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors">Annuler</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !tierId}
            className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Assignation...' : 'Assigner'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Operator row actions ──────────────────────────────────────────────────────

function OperatorActions({ operator, tiers, onAssign }: {
  operator: Operator;
  tiers: SaasTier[];
  onAssign: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renew = useMutation({
    mutationFn: () => adminApi.renewSubscription(operator.id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['operators'] }); setOpen(false); },
    onError: (err) => setError(apiError(err)),
  });

  const cancel = useMutation({
    mutationFn: () => adminApi.cancelSubscription(operator.id, 'Résiliation manuelle'),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['operators'] }); setOpen(false); },
    onError: (err) => setError(apiError(err)),
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors flex items-center gap-1 text-xs border"
      >
        Actions <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-card border rounded-xl shadow-xl w-44 py-1 text-sm">
            <button
              onClick={() => { setOpen(false); onAssign(); }}
              className="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Crown className="h-3.5 w-3.5 text-violet-400" />
              Changer tier
            </button>
            {operator.subscriptionStatus === 'ACTIVE' && (
              <button
                onClick={() => renew.mutate()}
                disabled={renew.isPending}
                className="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5 text-green-400" />
                {renew.isPending ? 'Renouvellement...' : 'Renouveler'}
              </button>
            )}
            {operator.subscriptionStatus && operator.subscriptionStatus !== 'CANCELLED' && (
              <button
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                className="w-full text-left px-3 py-2 hover:bg-muted text-red-400 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                {cancel.isPending ? 'Résiliation...' : 'Résilier'}
              </button>
            )}
            {error && <p className="px-3 py-1 text-xs text-destructive">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OperatorsPage() {
  const qc = useQueryClient();
  const [showProvision, setShowProvision] = useState(false);
  const [tempPw, setTempPw] = useState<{ password: string; email: string } | null>(null);
  const [assignTarget, setAssignTarget] = useState<Operator | null>(null);

  const { data: opsData, isLoading: opsLoading } = useQuery({
    queryKey: ['operators'],
    queryFn: async () => {
      const res = await adminApi.listOperators();
      return (res.data as any)?.data as { items: Operator[]; total: number };
    },
    staleTime: 30_000,
  });

  const { data: tiersData } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: async () => {
      const res = await adminApi.listTiers();
      return (res.data as any)?.data as SaasTier[];
    },
    staleTime: 60_000,
  });

  const operators = opsData?.items ?? [];
  const tiers = tiersData ?? [];
  const total = opsData?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Opérateurs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} opérateur{total !== 1 ? 's' : ''} · Gestion des comptes et abonnements SaaS
          </p>
        </div>
        <button
          onClick={() => setShowProvision(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvel opérateur
        </button>
      </div>

      {/* Stats bar */}
      {operators.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'Abonnements actifs',
              value: operators.filter(o => o.subscriptionStatus === 'ACTIVE').length,
              icon: Crown, color: 'text-green-400',
            },
            {
              label: 'Routeurs total',
              value: operators.reduce((a, o) => a + o.routerCount, 0),
              icon: Wifi, color: 'text-blue-400',
            },
            {
              label: 'Tickets total',
              value: operators.reduce((a, o) => a + o.totalVouchers, 0),
              icon: Ticket, color: 'text-violet-400',
            },
            {
              label: 'Revenu ce mois',
              value: fmt(operators.reduce((a, o) => a + o.revenueThisMonthXof, 0)),
              icon: TrendingUp, color: 'text-amber-400',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-lg font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {opsLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
            Chargement...
          </div>
        ) : operators.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm">Aucun opérateur. Créez le premier.</p>
            <button
              onClick={() => setShowProvision(true)}
              className="text-sm text-primary hover:underline"
            >
              + Nouvel opérateur
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Opérateur</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Tier</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Expiration</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Routeurs</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Revenu mois</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {operators.map(op => (
                  <tr key={op.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <AvatarInitials firstName={op.firstName} lastName={op.lastName} />
                        <div>
                          <p className="font-medium text-sm">{op.firstName} {op.lastName}</p>
                          <p className="text-xs text-muted-foreground">{op.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge slug={op.tierSlug} name={op.tierName} />
                    </td>
                    <td className="px-4 py-3">
                      <SubStatusBadge status={op.subscriptionStatus} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {fmtDate(op.subscriptionEndDate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium">{op.activeRouterCount}</span>
                      <span className="text-muted-foreground text-xs">/{op.routerCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-medium">
                      {fmt(op.revenueThisMonthXof)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {fmt(op.revenueTotalXof)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <OperatorActions
                        operator={op}
                        tiers={tiers}
                        onAssign={() => setAssignTarget(op)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showProvision && (
        <ProvisionModal
          tiers={tiers}
          onClose={() => setShowProvision(false)}
          onSuccess={(password, email) => {
            setShowProvision(false);
            setTempPw({ password, email });
            void qc.invalidateQueries({ queryKey: ['operators'] });
          }}
        />
      )}

      {tempPw && (
        <TempPasswordModal
          password={tempPw.password}
          email={tempPw.email}
          onClose={() => setTempPw(null)}
        />
      )}

      {assignTarget && (
        <AssignSubModal
          operator={assignTarget}
          tiers={tiers}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  );
}
