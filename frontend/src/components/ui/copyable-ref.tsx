'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { clsx } from 'clsx';

interface CopyableRefProps {
  value: string;
  truncate?: number;
  className?: string;
}

export function CopyableRef({ value, truncate = 14, className }: CopyableRefProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard API not available (HTTP context or permission denied) — silent fail
    });
  };

  const display =
    value.length > truncate ? `${value.slice(0, truncate)}…` : value;

  return (
    <span className={clsx('inline-flex items-center gap-1', className)}>
      <span
        className="font-mono text-[11px] text-muted-foreground"
        title={value}
      >
        {display}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copier la référence ${value}`}
        className={clsx(
          'rounded p-0.5 transition-all duration-200 ease-out active:scale-[0.98]',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        )}
      >
        {copied ? (
          <Check className="h-3 w-3 text-success" aria-hidden="true" />
        ) : (
          <Copy className="h-3 w-3" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}
