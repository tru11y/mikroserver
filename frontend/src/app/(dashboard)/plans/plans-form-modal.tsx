'use client';

import { useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { PlanFormFields } from './plan-form-fields';
import type { Plan, PlanFormData } from './plans.types';

interface PlansFormModalProps {
  open: boolean;
  editingPlan: Plan | null;
  form: PlanFormData;
  setForm: Dispatch<SetStateAction<PlanFormData>>;
  isPending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: () => void;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function PlansFormModal({
  open,
  editingPlan,
  form,
  setForm,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: PlansFormModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, isPending]);

  if (!open) return null;

  const isSubmitDisabled =
    isPending || !form.name.trim() || form.priceXof <= 0 || form.durationMinutes <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
      onClick={() => { if (!isPending) onClose(); }}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border bg-card shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border/40 p-6 flex-shrink-0">
          <div>
            <h2 id="plan-modal-title" className="text-lg font-bold">
              {editingPlan ? 'Modifier le forfait' : 'Nouveau forfait'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {editingPlan
                ? editingPlan.slug
                : 'Configurez prix, vitesse et comportement ticket comme sur le terrain.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { if (!isPending) onClose(); }}
            disabled={isPending}
            aria-label="Fermer la fenêtre"
            className={[
              'rounded-lg p-1.5 text-muted-foreground',
              'transition-all duration-200 ease-out',
              'hover:bg-muted hover:text-foreground',
              'active:scale-[0.98]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              focusRing,
            ].join(' ')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto p-6 flex-1">
          <PlanFormFields form={form} setForm={setForm} />
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 p-6 space-y-3 flex-shrink-0">
          {errorMessage && (
            <p
              role="alert"
              className="rounded-lg bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.2)] px-3 py-2 text-sm text-[hsl(var(--destructive))]"
            >
              {errorMessage}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { if (!isPending) onClose(); }}
              disabled={isPending}
              className={[
                'rounded-lg border px-4 py-2 text-sm',
                'transition-all duration-200 ease-out',
                'hover:bg-muted',
                'active:scale-[0.98]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                focusRing,
              ].join(' ')}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitDisabled}
              aria-describedby={isSubmitDisabled && !isPending ? 'plan-submit-hint' : undefined}
              className={[
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
                'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]',
                'transition-all duration-200 ease-out',
                'hover:bg-[hsl(var(--primary-hover))] hover:shadow-[var(--shadow-glow)]',
                'active:scale-[0.98]',
                'disabled:cursor-not-allowed disabled:opacity-50',
                focusRing,
              ].join(' ')}
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {editingPlan ? 'Enregistrer' : 'Créer le forfait'}
            </button>
          </div>
          {!isPending && isSubmitDisabled && (
            <p id="plan-submit-hint" className="text-xs text-muted-foreground text-right">
              Nom, prix et durée sont requis.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
