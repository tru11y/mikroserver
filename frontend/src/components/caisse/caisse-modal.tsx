'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { api, unwrap } from '@/lib/api';
import { toast } from 'sonner';
import { CheckCircle2, Copy, Loader2, Ticket, X } from 'lucide-react';

interface Plan { id: string; name: string; priceXof: number; durationMinutes: number; }
interface Router { id: string; name: string; status: string; }
interface GeneratedVoucher { id: string; code: string; passwordPlain: string; plan: { name: string; priceXof: number }; }

function fmtDuration(m: number): string {
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}j`;
}
function fmtXof(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n) + ' F';
}

interface CaisseModalProps {
  open: boolean;
  onClose: () => void;
}

export function CaisseModal({ open, onClose }: CaisseModalProps) {
  const firstRef = useRef<HTMLButtonElement>(null);
  const [planId, setPlanId] = useState('');
  const [routerId, setRouterId] = useState('');
  const [generated, setGenerated] = useState<GeneratedVoucher | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: plansData } = useQuery({
    queryKey: ['caisse-plans'],
    queryFn: () => api.plans.list(),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: routersData } = useQuery({
    queryKey: ['caisse-routers'],
    queryFn: () => api.routers.list(),
    enabled: open,
    staleTime: 60_000,
  });

  const plans: Plan[] = plansData ? (unwrap<Plan[]>(plansData) ?? []) : [];
  const routers: Router[] = routersData
    ? (() => {
        const r = unwrap<{ data?: Router[] } | Router[]>(routersData);
        return (Array.isArray(r) ? r : (r as { data?: Router[] })?.data) ?? [];
      })()
    : [];
  const onlineRouters = routers.filter((r) => r.status === 'ONLINE' || r.status === 'DEGRADED');

  // Auto-select defaults
  useEffect(() => {
    if (open && plans.length && !planId) setPlanId(plans[0].id);
  }, [open, plans, planId]);
  useEffect(() => {
    if (open && onlineRouters.length && !routerId) setRouterId(onlineRouters[0]?.id ?? '');
  }, [open, onlineRouters, routerId]);

  const generateMutation = useMutation({
    mutationFn: () =>
      api.vouchers.generateBulk({ planId, routerId, count: 1 }),
    onSuccess: (res) => {
      const list = unwrap<GeneratedVoucher[]>(res);
      const v = Array.isArray(list) ? list[0] : (list as unknown as { data?: GeneratedVoucher[] })?.data?.[0];
      if (v) setGenerated(v);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Génération impossible');
    },
  });

  const handleCopy = () => {
    if (!generated) return;
    void navigator.clipboard.writeText(generated.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Code copié');
  };

  const handleReset = () => {
    setGenerated(null);
    setCopied(false);
  };

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => { setGenerated(null); setCopied(false); }, 300);
    }
  }, [open]);

  // Keyboard close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setTimeout(() => firstRef.current?.focus(), 80);
  }, [open]);

  if (!open) return null;

  const canGenerate = !!planId && !!routerId && !generateMutation.isPending;
  const selectedPlan = plans.find((p) => p.id === planId);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mode Caisse — Générer un ticket"
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-3"
      >
        <div className="rounded-xl border bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Ticket className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold leading-tight">Mode Caisse</h2>
                <p className="text-[11px] text-muted-foreground">Génération rapide 2 clics</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {generated ? (
            /* ─── Result ───────────────────────────────────────────────── */
            <div className="p-5 space-y-4">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {generated.plan.name} · {fmtXof(generated.plan.priceXof)}
                </p>
                <p className="font-mono text-2xl font-bold tracking-[0.2em] text-primary">
                  {generated.code}
                </p>
                {generated.passwordPlain && generated.passwordPlain !== generated.code && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Mot de passe : <span className="font-mono font-semibold">{generated.passwordPlain}</span>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className={clsx(
                    'flex-1 inline-flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold transition-all',
                    copied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copié !' : 'Copier le code'}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-md border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  Nouveau
                </button>
              </div>
            </div>
          ) : (
            /* ─── Form ──────────────────────────────────────────────────── */
            <div className="p-5 space-y-4">
              {/* Plans grid */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Forfait</p>
                {plans.length === 0 ? (
                  <div className="h-10 bg-muted animate-pulse rounded-md" />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {plans.map((p, idx) => (
                      <button
                        key={p.id}
                        ref={idx === 0 ? firstRef : undefined}
                        type="button"
                        onClick={() => setPlanId(p.id)}
                        className={clsx(
                          'rounded-md border px-3 py-2 text-left transition-all',
                          planId === p.id
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                            : 'hover:bg-muted/50',
                        )}
                      >
                        <p className="text-xs font-semibold truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">{fmtDuration(p.durationMinutes)} · {fmtXof(p.priceXof)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Router select */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Routeur</p>
                {onlineRouters.length === 0 ? (
                  <p className="text-xs text-muted-foreground rounded-md border bg-muted/20 px-3 py-2">
                    Aucun routeur en ligne
                  </p>
                ) : onlineRouters.length <= 4 ? (
                  <div className="flex flex-wrap gap-2">
                    {onlineRouters.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRouterId(r.id)}
                        className={clsx(
                          'rounded-md border px-3 py-1.5 text-xs font-medium transition-all',
                          routerId === r.id
                            ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                            : 'hover:bg-muted/50',
                        )}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <select
                    aria-label="Sélectionner un routeur"
                    value={routerId}
                    onChange={(e) => setRouterId(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {onlineRouters.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Summary + CTA */}
              {selectedPlan && routerId && (
                <div className="rounded-md bg-muted/30 border px-3 py-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {selectedPlan.name} · {fmtDuration(selectedPlan.durationMinutes)}
                  </span>
                  <span className="font-bold text-primary">{fmtXof(selectedPlan.priceXof)}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => generateMutation.mutate()}
                disabled={!canGenerate}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Génération…</>
                ) : (
                  <><Ticket className="h-4 w-4" /> Générer le ticket</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
