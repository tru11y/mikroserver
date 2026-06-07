'use client';

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, Crown, Loader2, RefreshCw, ShieldOff, ShieldCheck, KeyRound, XCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Operator } from '@/lib/api/admin';

interface OperatorActionsMenuProps {
  operator: Operator;
  canManage: boolean;
  isRenewing: boolean;
  isCancelling: boolean;
  isResettingPassword: boolean;
  isSuspending: boolean;
  onAssign: () => void;
  onRenew: () => void;
  onCancel: () => void;
  onResetPassword: () => void;
  onSuspend: () => void;
  onUnsuspend: () => void;
}

export function OperatorActionsMenu({
  operator,
  canManage,
  isRenewing,
  isCancelling,
  isResettingPassword,
  isSuspending,
  onAssign,
  onRenew,
  onCancel,
  onResetPassword,
  onSuspend,
  onUnsuspend,
}: OperatorActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wasOpenedRef = useRef(false);

  const canRenew = operator.subscriptionStatus === 'ACTIVE';
  const canCancel =
    operator.subscriptionStatus !== null && operator.subscriptionStatus !== 'CANCELLED';
  const isSuspended = operator.status === 'SUSPENDED';

  useEffect(() => {
    if (open) {
      wasOpenedRef.current = true;
      const first = menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]:not([disabled])',
      );
      first?.focus();
    } else if (wasOpenedRef.current) {
      triggerRef.current?.focus();
    }
  }, [open]);

  if (!canManage) return null;

  function handleClose() {
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from<HTMLElement>(
      menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') ?? [],
    );
    const idx = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      handleClose();
    }
  }

  const itemBase =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50';
  const itemDestructive =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[hsl(var(--destructive))] transition-colors duration-150 hover:bg-[hsl(var(--destructive)/0.08)] focus-visible:bg-[hsl(var(--destructive)/0.08)] focus-visible:outline-none disabled:opacity-50';

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          data-state={open ? 'open' : 'closed'}
          aria-label={`Actions pour ${operator.firstName} ${operator.lastName}`}
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Actions
          <ChevronDown
            className={clsx('h-3 w-3 transition-transform duration-200', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={handleClose}
              aria-hidden="true"
            />
            <div
              ref={menuRef}
              role="menu"
              onKeyDown={handleKeyDown}
              className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-xl border bg-card py-1 text-sm [box-shadow:var(--shadow-lg)]"
            >
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => { handleClose(); onAssign(); }}
                className={itemBase}
              >
                <Crown className="h-3.5 w-3.5 text-[hsl(var(--primary))]" aria-hidden="true" />
                Changer tier
              </button>

              {canRenew && (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => { handleClose(); onRenew(); }}
                  disabled={isRenewing}
                  className={itemBase}
                >
                  {isRenewing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(var(--success))]" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 text-[hsl(var(--success))]" aria-hidden="true" />
                  )}
                  {isRenewing ? 'Renouvellement…' : 'Renouveler'}
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => { handleClose(); onResetPassword(); }}
                disabled={isResettingPassword}
                className={itemBase}
              >
                {isResettingPassword ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(var(--warning))]" aria-hidden="true" />
                ) : (
                  <KeyRound className="h-3.5 w-3.5 text-[hsl(var(--warning))]" aria-hidden="true" />
                )}
                {isResettingPassword ? 'Réinitialisation…' : 'Reset mot de passe'}
              </button>

              <div className="my-1 border-t" role="separator" />

              {isSuspended ? (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => { handleClose(); onUnsuspend(); }}
                  disabled={isSuspending}
                  className={itemBase}
                >
                  {isSuspending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(var(--success))]" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--success))]" aria-hidden="true" />
                  )}
                  {isSuspending ? 'Réactivation…' : 'Réactiver le compte'}
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => { handleClose(); onSuspend(); }}
                  disabled={isSuspending}
                  className={itemDestructive}
                >
                  {isSuspending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {isSuspending ? 'Suspension…' : 'Suspendre le compte'}
                </button>
              )}

              {canCancel && (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => { handleClose(); setConfirmCancel(true); }}
                  disabled={isCancelling}
                  className={itemDestructive}
                >
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Résilier l'abonnement
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Résilier l'abonnement"
        description={`L'abonnement de ${operator.firstName} ${operator.lastName} sera résilié immédiatement. L'opérateur conserve l'accès jusqu'à la fin de la période en cours.`}
        confirmLabel="Résilier"
        isLoading={isCancelling}
        onConfirm={() => { setConfirmCancel(false); onCancel(); }}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  );
}
