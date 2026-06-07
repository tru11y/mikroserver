'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';

interface VoucherCodeCellProps {
  code: string;
  subtext?: string;
  className?: string;
}

export function VoucherCodeCell({ code, subtext, className }: VoucherCodeCellProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Code copié');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copie impossible');
    }
  };

  return (
    <div className={clsx('flex items-start gap-1.5', className)}>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs font-bold tracking-widest text-primary">{code}</p>
        {subtext && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{subtext}</p>
        )}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copier le code ${code}`}
        className="mt-0.5 flex-shrink-0 rounded p-0.5 text-muted-foreground transition-all duration-200 ease-out hover:bg-muted hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span aria-live="polite" className="sr-only">
          {copied ? 'Code copié' : ''}
        </span>
        {copied ? (
          <Check className="h-3 w-3 text-success" aria-hidden="true" />
        ) : (
          <Copy className="h-3 w-3" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
