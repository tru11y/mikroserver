'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ShieldAlert } from 'lucide-react';

interface OperatorTempPasswordModalProps {
  open: boolean;
  password: string | null;
  email: string | null;
  onClose: () => void;
}

export function OperatorTempPasswordModal({
  open,
  password,
  email,
  onClose,
}: OperatorTempPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open, onClose]);

  if (!open || !password || !email) return null;

  async function handleCopy() {
    await navigator.clipboard.writeText(password!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="temp-pw-modal-title"
    >
      <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--success)/0.15)]">
            <Check className="h-5 w-5 text-[hsl(var(--success))]" aria-hidden="true" />
          </div>
          <div>
            <h2 id="temp-pw-modal-title" className="text-base font-semibold">
              Opérateur créé
            </h2>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>

        <div className="rounded-xl border border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.08)] p-3">
          <p className="mb-2 text-xs font-medium text-[hsl(var(--success))]">
            Mot de passe temporaire :
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all rounded-lg border bg-background px-3 py-2 font-mono text-sm">
              {password}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Mot de passe copié' : 'Copier le mot de passe'}
              className="shrink-0 rounded-lg border p-2 transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {copied ? (
                <Check className="h-4 w-4 text-[hsl(var(--success))]" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.08)] p-3">
          <ShieldAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]"
            aria-hidden="true"
          />
          <p className="text-xs text-[hsl(var(--warning))]">
            Ce mot de passe ne sera plus affiché. Transmettez-le à l&apos;opérateur via un canal
            sécurisé.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-all duration-200 ease-out hover:bg-[hsl(var(--primary-hover))] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
