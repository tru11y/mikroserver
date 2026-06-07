'use client';

import { useState } from 'react';
import { Loader2, Shield, ShieldOff } from 'lucide-react';
import { clsx } from 'clsx';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface CustomersBanButtonProps {
  customerId: string;
  isBlocked: boolean;
  canBlock: boolean;
  isPending: boolean;
  onMutate: (isBlocked: boolean) => void;
  variant?: 'icon' | 'full';
}

export function CustomersBanButton({
  isBlocked,
  canBlock,
  isPending,
  onMutate,
  variant = 'icon',
}: CustomersBanButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!canBlock) return null;

  const handleClick = () => {
    if (!isBlocked) {
      setConfirmOpen(true);
    } else {
      onMutate(false);
    }
  };

  if (variant === 'full') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          aria-label={isBlocked ? 'Débloquer le client' : 'Bloquer le client'}
          className={clsx(
            'inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            isBlocked
              ? 'border-success text-success hover:bg-success/10'
              : 'border-destructive text-destructive hover:bg-destructive/10',
          )}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : isBlocked ? (
            <ShieldOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Shield className="h-4 w-4" aria-hidden="true" />
          )}
          {isBlocked ? 'Débloquer' : 'Bloquer'}
        </button>
        <ConfirmDialog
          open={confirmOpen}
          title="Bloquer ce client ?"
          description="Le client ne pourra plus se connecter au réseau WiFi tant qu'il est bloqué."
          confirmLabel="Bloquer"
          isLoading={isPending}
          onConfirm={() => { setConfirmOpen(false); onMutate(true); }}
          onCancel={() => setConfirmOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={isBlocked ? 'Débloquer le client' : 'Bloquer le client'}
        className={clsx(
          'h-9 w-9 inline-flex items-center justify-center rounded-md border shrink-0',
          'active:scale-[0.98] transition-all duration-200 ease-out',
          'disabled:opacity-50 disabled:pointer-events-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isBlocked
            ? 'text-success hover:bg-success/10 border-success/30'
            : 'text-destructive hover:bg-destructive/10 border-destructive/30',
        )}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : isBlocked ? (
          <ShieldOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Shield className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title="Bloquer ce client ?"
        description="Le client ne pourra plus se connecter au réseau WiFi tant qu'il est bloqué."
        confirmLabel="Bloquer"
        isLoading={isPending}
        onConfirm={() => { setConfirmOpen(false); onMutate(true); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
