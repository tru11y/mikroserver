'use client';

import { useEffect, useState } from 'react';
import { useFocusTrap } from '@/lib/use-focus-trap';
import { Crown, Loader2 } from 'lucide-react';
import type { Operator, SaasTier } from '@/lib/api/admin';
import { formatXof } from '@/lib/formatters';

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface OperatorAssignTierModalProps {
  operator: Operator;
  tiers: SaasTier[];
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (tierId: string, billingCycle: 'MONTHLY' | 'YEARLY') => void;
}

export function OperatorAssignTierModal({
  operator,
  tiers,
  isPending,
  error,
  onClose,
  onSubmit,
}: OperatorAssignTierModalProps) {
  const [tierId, setTierId] = useState('');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  const trapRef = useFocusTrap(true);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const activeTiers = tiers.filter((t) => t.isActive);
  const selectedTier = activeTiers.find((t) => t.id === tierId);

  const cycleOptions: { value: 'MONTHLY' | 'YEARLY'; label: string }[] = [
    {
      value: 'MONTHLY',
      label: selectedTier
        ? `Mensuel — ${formatXof(selectedTier.priceXofMonthly)}`
        : 'Mensuel',
    },
    {
      value: 'YEARLY',
      label: selectedTier?.priceXofYearly
        ? `Annuel — ${formatXof(selectedTier.priceXofYearly)}`
        : 'Annuel',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-tier-modal-title"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.15)]">
            <Crown className="h-5 w-5 text-[hsl(var(--primary))]" aria-hidden="true" />
          </div>
          <div>
            <h2 id="assign-tier-modal-title" className="text-base font-semibold">
              Assigner un abonnement
            </h2>
            <p className="text-xs text-muted-foreground">
              {operator.firstName} {operator.lastName} — {operator.email}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="at-tier">
              Tier SaaS *
            </label>
            <select
              id="at-tier"
              value={tierId}
              onChange={(e) => setTierId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Choisir un tier —</option>
              {activeTiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {formatXof(t.priceXofMonthly)}/mois
                  {t.priceXofYearly ? ` | ${formatXof(t.priceXofYearly)}/an` : ''}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs text-muted-foreground">Facturation</legend>
            <div className="flex gap-2">
              {cycleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBillingCycle(opt.value)}
                  data-selected={billingCycle === opt.value}
                  className={`flex-1 rounded-xl border py-2 text-sm transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    billingCycle === opt.value
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                      : 'hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {error && (
          <p role="alert" className="text-xs text-[hsl(var(--destructive))]">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={`${btnBase} border hover:bg-muted disabled:opacity-50`}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onSubmit(tierId, billingCycle)}
            disabled={isPending || !tierId}
            className={`${btnBase} bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary-hover))] hover:[box-shadow:var(--shadow-glow)] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            )}
            {isPending ? 'Assignation…' : 'Assigner'}
          </button>
        </div>
      </div>
    </div>
  );
}
