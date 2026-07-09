'use client';

import { Users } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Skeleton } from '@/components/ui/skeleton';
import { ResellerCard } from './reseller-card';
import type { Reseller } from './resellers.types';

interface ResellersDirectorySectionProps {
  users: Reseller[];
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  canManageUsers: boolean;
  canDeleteUsers: boolean;
  suspendingId: string | null;
  activatingId: string | null;
  isDeleting: boolean;
  onOpenProfile: (reseller: Reseller) => void;
  onOpenAccess: (reseller: Reseller) => void;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}

function DirectorySkeleton() {
  return (
    <div className="grid gap-4 p-4 lg:p-6 xl:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-4 rounded-[24px] border border-white/10 p-5">
          <div className="flex items-start gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3.5 w-52" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
          <Skeleton className="h-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ResellersDirectorySection({
  users,
  isLoading,
  errorMessage,
  onRetry,
  canManageUsers,
  canDeleteUsers,
  suspendingId,
  activatingId,
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
      aria-labelledby="directory-heading"
      className="overflow-hidden rounded-[28px] border bg-card/95 shadow-xl"
    >
      <div className="border-b border-border/70 bg-gradient-to-br from-primary/8 to-transparent px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="directory-heading" className="text-lg font-semibold tracking-tight">
              Annuaire des comptes
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Identité, niveau d&apos;accès et actions pour chaque revendeur.
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
        <DirectorySkeleton />
      ) : errorMessage ? (
        <div className="p-10">
          <ErrorState
            title="Impossible de charger l'annuaire"
            message={errorMessage}
            onRetry={onRetry}
          />
        </div>
      ) : users.length === 0 ? (
        <div className="p-10">
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Aucun compte sur ce filtre"
            description="Ajuste la recherche, le rôle ou le statut pour faire remonter les bons profils."
          />
        </div>
      ) : (
        <div className="grid gap-4 p-4 lg:p-6 xl:grid-cols-2">
          {users.map((reseller) => (
            <ResellerCard
              key={reseller.id}
              reseller={reseller}
              canManageUsers={canManageUsers}
              canDeleteUsers={canDeleteUsers}
              isSuspendingThis={suspendingId === reseller.id}
              isActivatingThis={activatingId === reseller.id}
              isDeleting={isDeleting}
              onOpenProfile={onOpenProfile}
              onOpenAccess={onOpenAccess}
              onSuspend={onSuspend}
              onActivate={onActivate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
