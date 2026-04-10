'use client';

import { clsx } from 'clsx';
import {
  AlertCircle,
  Clock3,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  Shield,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Users,
} from 'lucide-react';
import type { Reseller } from './resellers.types';
import {
  buildProfileLabel,
  formatResellerDate,
  formatResellerDateTime,
  getRoleLabel,
  getUserInitials,
  statusConfig,
} from './resellers.utils';

interface ResellersDirectorySectionProps {
  users: Reseller[];
  isLoading: boolean;
  errorMessage: string | null;
  canManageUsers: boolean;
  canDeleteUsers: boolean;
  isSuspending: boolean;
  isActivating: boolean;
  isDeleting: boolean;
  onOpenProfile: (reseller: Reseller) => void;
  onOpenAccess: (reseller: Reseller) => void;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ResellersDirectorySection({
  users,
  isLoading,
  errorMessage,
  canManageUsers,
  canDeleteUsers,
  isSuspending,
  isActivating,
  isDeleting,
  onOpenProfile,
  onOpenAccess,
  onSuspend,
  onActivate,
  onDelete,
}: ResellersDirectorySectionProps) {
  return (
    <section
      id="directory"
      className="overflow-hidden rounded-[28px] border bg-card/95 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.85)]"
    >
      <div className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(56,189,248,0.12),rgba(2,6,23,0.02))] px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Annuaire des comptes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Une vue plus lisible des contacts, des niveaux d&apos;acces et des actions
              sensibles.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {users.length} compte{users.length !== 1 ? 's' : ''} visible
            {users.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 p-6 xl:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-52 animate-pulse rounded-[24px] border border-white/10 bg-muted/20"
            />
          ))}
        </div>
      ) : errorMessage ? (
        <div className="p-10">
          <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Impossible de charger l&apos;annuaire</p>
              <p className="mt-1 text-red-100/80">{errorMessage}</p>
            </div>
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Aucun compte sur ce filtre</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajuste la recherche, le role ou le statut pour faire remonter les bons profils.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 p-4 lg:p-6 xl:grid-cols-2">
          {users.map((reseller) => {
            const sc = statusConfig[reseller.status] ?? statusConfig.ACTIVE;
            const canManageTarget = canManageUsers && reseller.role !== 'SUPER_ADMIN';

            return (
              <article
                key={reseller.id}
                className="group rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_24px_50px_-36px_rgba(14,165,233,0.55)]"
              >
                <div className="flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(56,189,248,0.22),rgba(14,165,233,0.08))] text-base font-semibold text-sky-100 ring-1 ring-sky-300/20">
                        {getUserInitials(reseller)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-semibold tracking-tight">
                            {reseller.firstName} {reseller.lastName}
                          </h3>
                          <span
                            className={clsx(
                              'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                              sc.cls,
                            )}
                          >
                            {sc.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {getRoleLabel(reseller.role)}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" />
                            {reseller.email}
                          </span>
                          {reseller.phone ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" />
                              {reseller.phone}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Profil
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {buildProfileLabel(
                          reseller.permissionProfile,
                          reseller.permissionOverrides,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {reseller.permissions.length} permission
                        {reseller.permissions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="rounded-2xl border border-white/8 bg-background/40 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Derniere connexion
                      </p>
                      <p className="mt-2 inline-flex items-center gap-2 text-sm">
                        <Clock3 className="h-3.5 w-3.5 text-sky-300" />
                        {formatResellerDateTime(reseller.lastLoginAt)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-background/40 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Creation
                      </p>
                      <p className="mt-2 text-sm">{formatResellerDate(reseller.createdAt)}</p>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-background/40 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Gouvernance
                      </p>
                      <p className="mt-2 inline-flex items-center gap-2 text-sm">
                        <Shield className="h-3.5 w-3.5 text-emerald-300" />
                        {reseller.permissionOverrides.length > 0
                          ? 'Mode personnalise'
                          : 'Profil standard'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
                    <div className="text-xs text-muted-foreground">
                      {reseller.role === 'SUPER_ADMIN'
                        ? 'Compte critique protege contre les actions deleguees.'
                        : 'Actions securisees et journalisables depuis cet ecran.'}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canManageTarget ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenProfile(reseller)}
                            className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sm text-sky-100 transition-all hover:bg-sky-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Profil
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenAccess(reseller)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm transition-all hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Acces
                          </button>
                          {reseller.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              onClick={() => onSuspend(reseller.id)}
                              disabled={isSuspending}
                              className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100 transition-all hover:bg-amber-400/20 disabled:opacity-60"
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                              Suspendre
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onActivate(reseller.id)}
                              disabled={isActivating}
                              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 transition-all hover:bg-emerald-400/20 disabled:opacity-60"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Reactiver
                            </button>
                          )}
                        </>
                      ) : null}

                      {canDeleteUsers && reseller.role !== 'SUPER_ADMIN' ? (
                        <button
                          type="button"
                          onClick={() => onDelete(reseller.id)}
                          disabled={isDeleting}
                          className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100 transition-all hover:bg-red-400/20 disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
