'use client';

import { clsx } from 'clsx';
import {
  Clock3,
  KeyRound,
  Loader2,
  Pencil,
  Shield,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from 'lucide-react';
import { AccessStatusBadge } from '@/components/ui/access-status-badge';
import { ResellerAvatar } from '@/components/ui/reseller-avatar';
import type { Reseller } from './resellers.types';
import {
  buildProfileLabel,
  formatResellerDate,
  formatResellerDateTime,
  getRoleLabel,
} from './resellers.utils';

interface ResellerCardProps {
  reseller: Reseller;
  canManageUsers: boolean;
  canDeleteUsers: boolean;
  isSuspendingThis: boolean;
  isActivatingThis: boolean;
  isDeleting: boolean;
  onOpenProfile: (reseller: Reseller) => void;
  onOpenAccess: (reseller: Reseller) => void;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}

const BTN_BASE =
  'touch-target inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:pointer-events-none';

const isRecentlyActive = (lastLoginAt: string | null): boolean => {
  if (!lastLoginAt) return false;
  return Date.now() - new Date(lastLoginAt).getTime() < 24 * 60 * 60 * 1000;
};

export function ResellerCard({
  reseller,
  canManageUsers,
  canDeleteUsers,
  isSuspendingThis,
  isActivatingThis,
  isDeleting,
  onOpenProfile,
  onOpenAccess,
  onSuspend,
  onActivate,
  onDelete,
}: ResellerCardProps) {
  const canManageTarget = canManageUsers && reseller.role !== 'SUPER_ADMIN';
  const recentlyActive = isRecentlyActive(reseller.lastLoginAt);
  const isSuspended = reseller.status === 'SUSPENDED';

  return (
    <article
      className={clsx(
        'group rounded-[24px] border bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-5',
        'transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-glow',
        isSuspended && 'opacity-80',
      )}
    >
      <div className="flex flex-col gap-5">
        {/* Header : identité + statut + profil */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <ResellerAvatar
              firstName={reseller.firstName}
              lastName={reseller.lastName}
              role={reseller.role}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-semibold tracking-tight">
                  {reseller.firstName} {reseller.lastName}
                </h3>
                <AccessStatusBadge status={reseller.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{getRoleLabel(reseller.role)}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="max-w-[180px] truncate">{reseller.email}</span>
                {reseller.phone ? <span>{reseller.phone}</span> : null}
              </div>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Profil</p>
            <p className="mt-1 text-sm font-medium">
              {buildProfileLabel(reseller.permissionProfile, reseller.permissionOverrides)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {reseller.permissions.length} permission
              {reseller.permissions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Dernière connexion
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm">
              {recentlyActive ? (
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
              ) : (
                <Clock3 className="h-3.5 w-3.5 text-info" aria-hidden="true" />
              )}
              <span>{formatResellerDateTime(reseller.lastLoginAt)}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Création
            </p>
            <p className="mt-2 text-sm">{formatResellerDate(reseller.createdAt)}</p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Gouvernance
            </p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm">
              <Shield className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              {reseller.permissionOverrides.length > 0 ? 'Personnalisé' : 'Profil standard'}
            </p>
          </div>
        </div>

        {/* Footer : actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
          <p className="text-xs text-muted-foreground">
            {reseller.role === 'SUPER_ADMIN'
              ? 'Compte critique protégé.'
              : 'Actions sécurisées et journalisables.'}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {canManageTarget ? (
              <>
                {/* Profil */}
                <button
                  type="button"
                  onClick={() => onOpenProfile(reseller)}
                  aria-label={`Modifier le profil de ${reseller.firstName} ${reseller.lastName}`}
                  className={clsx(BTN_BASE, 'border-info/20 bg-info/10 text-info hover:bg-info/20')}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Profil
                </button>

                {/* Accès */}
                <button
                  type="button"
                  onClick={() => onOpenAccess(reseller)}
                  aria-label={`Gérer les accès de ${reseller.firstName} ${reseller.lastName}`}
                  className={clsx(BTN_BASE, 'border-white/10 hover:bg-white/5')}
                >
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  Accès
                </button>

                <span className="h-5 w-px bg-white/10" aria-hidden="true" />

                {/* Suspendre / Réactiver */}
                {reseller.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={() => onSuspend(reseller.id)}
                    disabled={isSuspendingThis}
                    aria-label={`Suspendre ${reseller.firstName} ${reseller.lastName}`}
                    className={clsx(
                      BTN_BASE,
                      'border-warning/20 bg-warning/10 text-warning hover:bg-warning/20',
                    )}
                  >
                    {isSuspendingThis ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {isSuspendingThis ? 'Suspension...' : 'Suspendre'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onActivate(reseller.id)}
                    disabled={isActivatingThis}
                    aria-label={`Réactiver ${reseller.firstName} ${reseller.lastName}`}
                    className={clsx(
                      BTN_BASE,
                      'border-success/20 bg-success/10 text-success hover:bg-success/20',
                    )}
                  >
                    {isActivatingThis ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {isActivatingThis ? 'Réactivation...' : 'Réactiver'}
                  </button>
                )}
              </>
            ) : null}

            {/* Action dangereuse */}
            {canDeleteUsers && reseller.role !== 'SUPER_ADMIN' ? (
              <>
                {canManageTarget ? (
                  <span className="h-5 w-px bg-white/10" aria-hidden="true" />
                ) : null}
                <button
                  type="button"
                  onClick={() => onDelete(reseller.id)}
                  disabled={isDeleting}
                  aria-label={`Supprimer ${reseller.firstName} ${reseller.lastName}`}
                  className={clsx(
                    BTN_BASE,
                    'border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20',
                  )}
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {isDeleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
