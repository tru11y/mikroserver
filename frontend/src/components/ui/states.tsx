'use client';

import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, RefreshCw, SearchX, WifiOff } from 'lucide-react';

// ── ErrorState ─────────────────────────────────────────────────────────────

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  variant?: 'default' | 'inline';
}

export function ErrorState({
  title = 'Une erreur est survenue',
  message,
  onRetry,
  className,
  variant = 'default',
}: ErrorStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3 text-center',
        variant === 'default' ? 'rounded-xl border border-dashed p-10' : 'py-6',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        {message && (
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">{message}</p>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-out hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Réessayer
        </button>
      )}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <SearchX className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div>
        <p className="font-medium text-sm">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

// ── OfflineState ───────────────────────────────────────────────────────────

export function OfflineState({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={<WifiOff className="h-5 w-5" />}
      title="Routeur hors ligne"
      description="Ce routeur ne répond pas. Vérifiez la connexion WireGuard."
      className={className}
    />
  );
}
