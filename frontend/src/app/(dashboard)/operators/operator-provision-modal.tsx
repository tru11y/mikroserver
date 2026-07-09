'use client';

import { useEffect, useState } from 'react';
import { useFocusTrap } from '@/lib/use-focus-trap';
import { Loader2, Plus } from 'lucide-react';
import type { SaasTier } from '@/lib/api/admin';
import type { ProvisionPayload } from './use-operators-page';
import { formatXof } from '@/lib/formatters';

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface OperatorProvisionModalProps {
  tiers: SaasTier[];
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: ProvisionPayload) => void;
}

export function OperatorProvisionModal({
  tiers,
  isPending,
  error,
  onClose,
  onSubmit,
}: OperatorProvisionModalProps) {
  const [form, setForm] = useState<ProvisionPayload>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    tierId: '',
    billingCycle: 'MONTHLY',
  });

  const trapRef = useFocusTrap<HTMLFormElement>(true);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const activeTiers = tiers.filter((t) => t.isActive);
  const isValid = Boolean(form.email.trim() && form.firstName.trim() && form.lastName.trim());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone?.trim() || undefined,
      tierId: form.tierId || undefined,
      billingCycle: form.tierId ? form.billingCycle : undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="provision-modal-title"
      onClick={onClose}
    >
      <form
        ref={trapRef}
        className="w-full max-w-lg space-y-5 rounded-2xl border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.15)]">
            <Plus className="h-5 w-5 text-[hsl(var(--primary))]" aria-hidden="true" />
          </div>
          <div>
            <h2 id="provision-modal-title" className="text-base font-semibold">
              Nouvel opérateur
            </h2>
            <p className="text-xs text-muted-foreground">
              Crée le compte et assigne un abonnement
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="p-email">
              Email *
            </label>
            <input
              id="p-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="jean.kouassi@wifi-ci.com"
              className={inputClass}
              autoComplete="off"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="p-firstName">
              Prénom *
            </label>
            <input
              id="p-firstName"
              type="text"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              placeholder="Jean"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="p-lastName">
              Nom *
            </label>
            <input
              id="p-lastName"
              type="text"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              placeholder="Kouassi"
              className={inputClass}
            />
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="p-phone">
              Téléphone
            </label>
            <input
              id="p-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+2250700000000"
              className={inputClass}
            />
          </div>

          <div className={form.tierId ? '' : 'col-span-2'}>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="p-tier">
              Tier SaaS
            </label>
            <select
              id="p-tier"
              value={form.tierId}
              onChange={(e) => setForm((f) => ({ ...f, tierId: e.target.value }))}
              className={inputClass}
            >
              <option value="">— Sans abonnement —</option>
              {activeTiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {formatXof(t.priceXofMonthly)}/mois
                </option>
              ))}
            </select>
          </div>

          {form.tierId && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="p-cycle">
                Facturation
              </label>
              <select
                id="p-cycle"
                value={form.billingCycle}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    billingCycle: e.target.value as 'MONTHLY' | 'YEARLY',
                  }))
                }
                className={inputClass}
              >
                <option value="MONTHLY">Mensuel</option>
                <option value="YEARLY">Annuel</option>
              </select>
            </div>
          )}
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
            type="submit"
            disabled={isPending || !isValid}
            className={`${btnBase} bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary-hover))] hover:[box-shadow:var(--shadow-glow)] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            )}
            {isPending ? 'Création…' : "Créer l'opérateur"}
          </button>
        </div>
      </form>
    </div>
  );
}
