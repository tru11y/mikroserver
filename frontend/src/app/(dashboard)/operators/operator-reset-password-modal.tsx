'use client';

import { useEffect } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useFocusTrap } from '@/lib/use-focus-trap';
import type { Operator } from '@/lib/api/admin';

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface OperatorResetPasswordModalProps {
  operator: Operator;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function OperatorResetPasswordModal({
  operator,
  isPending,
  onClose,
  onConfirm,
}: OperatorResetPasswordModalProps) {
  const trapRef = useFocusTrap(true);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-pw-modal-title"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--warning)/0.15)]">
            <ShieldAlert className="h-5 w-5 text-[hsl(var(--warning))]" aria-hidden="true" />
          </div>
          <div>
            <h2 id="reset-pw-modal-title" className="text-base font-semibold">
              Réinitialiser le mot de passe
            </h2>
            <p className="text-xs text-muted-foreground">
              {operator.firstName} {operator.lastName} — {operator.email}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.08)] p-3">
          <p className="text-xs text-[hsl(var(--warning))]">
            Un nouveau mot de passe temporaire sera généré. L'opérateur devra le changer à la
            prochaine connexion. Transmettez-le via un canal sécurisé.
          </p>
        </div>

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
            onClick={onConfirm}
            disabled={isPending}
            className={`${btnBase} bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            )}
            {isPending ? 'Génération…' : 'Réinitialiser'}
          </button>
        </div>
      </div>
    </div>
  );
}
