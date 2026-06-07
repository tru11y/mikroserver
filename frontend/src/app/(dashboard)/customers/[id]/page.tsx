'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Trash2, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { customersApi } from '@/lib/api/customers';
import { sessionsApi } from '@/lib/api/sessions';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CustomerStatusBadge } from '@/components/ui/customer-status-badge';
import { MacAddressCell } from '@/components/ui/mac-address-cell';
import { CustomersBanButton } from '../customers-ban-button';
import { CustomerMetricsSection } from './customer-metrics-section';
import { CustomerActivitySection } from './customer-activity-section';
import { CustomerSessionsSection } from './customer-sessions-section';
import { CustomerProfileSection } from './customer-profile-section';

interface CustomerDetail {
  id: string;
  macAddress: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalSessions: number;
  totalDataBytes: string;
  totalSpentXof: number;
  isBlocked: boolean;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  notes: string | null;
  lastUsername: string | null;
  router: { id: string; name: string };
}

interface ActiveSession {
  id: string;
  mikrotikId: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  startedAt: string;
  router: { id: string; name: string };
  voucher: { code: string; plan: { name: string } | null } | null;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Auth / permissions
  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canBlock = hasPermission(currentUser, 'customers.block') || hasPermission(currentUser, 'customers.manage');
  const canDelete = hasPermission(currentUser, 'customers.delete') || hasPermission(currentUser, 'customers.manage');

  // Customer detail
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const res = await customersApi.findOne(id);
      return unwrap<CustomerDetail>(res);
    },
  });

  // Active sessions
  const { data: activeSessions = [] } = useQuery({
    queryKey: ['customer-sessions', id, customer?.macAddress],
    queryFn: async () => {
      if (!customer?.macAddress) return [];
      const res = await sessionsApi.byMac(customer.macAddress, customer.router.id);
      return (res.data as { data: ActiveSession[] }).data;
    },
    enabled: !!customer?.macAddress,
    refetchInterval: 30_000,
  });

  // Profile form state — driven by loaded customer, not set inside queryFn
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    notes: '',
  });

  useEffect(() => {
    if (customer) {
      setProfileForm({
        firstName: customer.firstName ?? '',
        lastName: customer.lastName ?? '',
        phone: customer.phone ?? '',
        notes: customer.notes ?? '',
      });
    }
  }, [customer]);

  // Update profile
  const updateMutation = useMutation({
    mutationFn: (data: typeof profileForm) => customersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', id] });
      toast.success('Profil mis à jour');
    },
    onError: () => toast.error('Échec de la mise à jour'),
  });

  // Block
  const blockMutation = useMutation({
    mutationFn: (isBlocked: boolean) => customersApi.block(id, isBlocked),
    onSuccess: (_, isBlocked) => {
      qc.invalidateQueries({ queryKey: ['customer', id] });
      toast.success(isBlocked ? 'Client bloqué' : 'Client débloqué');
    },
    onError: () => toast.error('Échec de la mise à jour'),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: () => customersApi.delete(id),
    onSuccess: () => { toast.success('Client supprimé'); router.push('/customers'); },
    onError: () => toast.error('Échec de la suppression'),
  });

  // Disconnect session
  const disconnectMutation = useMutation({
    mutationFn: (sessionId: string) => sessionsApi.forceDisconnect(sessionId),
    onSuccess: () => {
      toast.success('Session déconnectée');
      qc.invalidateQueries({ queryKey: ['customer-sessions', id] });
    },
    onError: () => toast.error('Échec de la déconnexion'),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-5 w-32" />
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Client introuvable.</div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux clients
      </button>

      {/* Header card */}
      <header className="bg-card border rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <MacAddressCell mac={customer.macAddress} className="text-xl font-bold" />
              <CustomerStatusBadge isBlocked={customer.isBlocked} />
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
              {customer.router.name}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <CustomersBanButton
              customerId={customer.id}
              isBlocked={customer.isBlocked}
              canBlock={canBlock}
              isPending={blockMutation.isPending}
              onMutate={(blocked) => blockMutation.mutate(blocked)}
              variant="full"
            />
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deleteMutation.isPending}
                aria-label="Supprimer le client"
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                Supprimer
              </button>
            )}
          </div>
        </div>
      </header>

      <CustomerMetricsSection
        totalSessions={customer.totalSessions}
        totalDataBytes={customer.totalDataBytes}
        totalSpentXof={customer.totalSpentXof}
      />

      <CustomerActivitySection
        firstSeenAt={customer.firstSeenAt}
        lastSeenAt={customer.lastSeenAt}
        lastUsername={customer.lastUsername}
      />

      <CustomerSessionsSection
        sessions={activeSessions}
        isDisconnectPending={disconnectMutation.isPending}
        onDisconnect={(sessionId) => disconnectMutation.mutate(sessionId)}
      />

      <CustomerProfileSection
        profile={{
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
          notes: customer.notes,
        }}
        isSavePending={updateMutation.isPending}
        onSave={async (data) => { await updateMutation.mutateAsync(data); }}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer ce client ?"
        description="Cette action est irréversible. Le profil et l'historique MAC seront supprimés."
        confirmLabel="Supprimer"
        isLoading={deleteMutation.isPending}
        onConfirm={() => { setDeleteConfirmOpen(false); deleteMutation.mutate(); }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
