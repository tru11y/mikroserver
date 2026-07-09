'use client';

import { useEffect } from 'react';
import { Loader2, ShieldOff, ShieldCheck } from 'lucide-react';
import { useFocusTrap } from '@/lib/use-focus-trap';
import type { Operator } from '@/lib/api/admin';

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface OperatorSuspendModalProps {
  operator: Operator;
  action: 'suspend' | 'unsuspend';
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function OperatorSuspendModal({
  operator,
  action,
  isPending,
  onClose,
  onConfirm,
}: OperatorSuspendModalProps) {
  const trapRef = useFocusTrap(true);
  const isSuspend = action === 'suspend';

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
      aria-labelledby="suspend-modal-title"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              isSuspend
                ? 'bg-[hsl(var(--destructive)/0.15)]'
                : 'bg-[hsl(var(--success)/0.15)]'
            }`}
          >
            {isSuspend ? (
              <ShieldOff
                className="h-5 w-5 text-[hsl(var(--destructive))]"
                aria-hidden="true"
              />
            ) : (
              <ShieldCheck
                className="h-5 w-5 text-[hsl(var(--success))]"
                aria-hidden="true"
              />
            )}
          </div>
          <div>
            <h2 id="suspend-modal-title" className="text-base font-semibold">
              {isSuspend ? 'Suspendre le compte' : 'Réactiver le compte'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {operator.firstName} {operator.lastName} — {operator.email}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {isSuspend
            ? "L'opérateur ne pourra plus se connecter immédiatement. Son abonnement reste inchangé."
            : "L'opérateur pourra de nouveau se connecter avec ses identifiants existants."}
        </p>

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
            className={
              isSuspend
                ? `${btnBase} bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50`
                : `${btnBase} bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50`
            }
          >
            {isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            )}
            {isPending
              ? isSuspend
                ? 'Suspension…'
                : 'Réactivation…'
              : isSuspend
              ? 'Suspendre'
              : 'Réactiver'}
          </button>
        </div>
      </div>
    </div>
  );
}
