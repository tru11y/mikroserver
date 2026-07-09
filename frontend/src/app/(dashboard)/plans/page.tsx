'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiError, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PlansHeroSection } from './plans-hero-section';
import { PlansCatalogSection } from './plans-catalog-section';
import { PlansFormModal } from './plans-form-modal';
import {
  buildDefaultForm,
  normalizePlanPayload,
  planFormFromPlan,
} from './plans.utils';
import type { Plan, PlanFormData } from './plans.types';

export default function PlansPage() {
  const queryClient = useQueryClient();

  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanFormData>(buildDefaultForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canManage = hasPermission(currentUser, 'plans.manage');
  const canView = hasPermission(currentUser, 'plans.view');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['plans', showArchived],
    queryFn: () => api.plans.list(showArchived),
    enabled: canView,
  });

  const plans: Plan[] =
    data ? (unwrap<Plan[]>(data) ?? (data as { data?: Plan[] })?.data ?? []) : [];
  const totalActive = plans.filter((p) => p.status === 'ACTIVE').length;
  const totalArchived = plans.filter((p) => p.status === 'ARCHIVED').length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['plans'] });

  const createMutation = useMutation({
    mutationFn: (payload: PlanFormData) => api.plans.create(normalizePlanPayload(payload)),
    onSuccess: async () => {
      await invalidate();
      closeModal();
      toast.success('Forfait créé avec succès');
    },
    onError: (err) => {
      toast.error(apiError(err, 'Erreur lors de la création du forfait'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PlanFormData }) =>
      api.plans.update(id, normalizePlanPayload(payload)),
    onSuccess: async () => {
      await invalidate();
      closeModal();
      toast.success('Forfait mis à jour');
    },
    onError: (err) => {
      toast.error(apiError(err, 'Erreur lors de la mise à jour'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.plans.delete(id),
    onSuccess: async () => {
      await invalidate();
      setConfirmDeleteId(null);
      toast.success('Forfait supprimé définitivement');
    },
    onError: (err, id) => {
      setConfirmDeleteId(null);
      const msg = apiError(err, 'Impossible de supprimer ce forfait');
      toast.error(msg);
      if (msg.includes('déjà utilisé')) {
        setConfirmArchiveId(id);
      }
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.plans.archive(id),
    onSuccess: async () => {
      await invalidate();
      setConfirmArchiveId(null);
      toast.success('Forfait archivé');
    },
    onError: (err) => {
      toast.error(apiError(err, "Impossible d'archiver ce forfait"));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.plans.restore(id),
    onSuccess: async () => {
      await invalidate();
      toast.success('Forfait restauré');
    },
    onError: (err) => {
      toast.error(apiError(err, 'Impossible de restaurer ce forfait'));
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (plan: Plan) =>
      api.plans.create(
        normalizePlanPayload({
          ...planFormFromPlan(plan),
          name: `${plan.name} (copie)`,
          isPopular: false,
        }),
      ),
    onSuccess: async () => {
      await invalidate();
      toast.success('Forfait dupliqué');
    },
    onError: (err) => {
      toast.error(apiError(err, 'Erreur lors de la duplication'));
    },
  });

  function openCreate() {
    setForm(buildDefaultForm());
    setEditingPlan(null);
    setShowForm(true);
  }

  function openEdit(plan: Plan) {
    setForm(planFormFromPlan(plan));
    setEditingPlan(plan);
    setShowForm(true);
  }

  function closeModal() {
    setShowForm(false);
    setEditingPlan(null);
    setForm(buildDefaultForm());
  }

  function handleSubmit() {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, payload: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const mutationError: string | null = createMutation.isError
    ? apiError(createMutation.error, 'Erreur lors de la création')
    : updateMutation.isError
      ? apiError(updateMutation.error, 'Erreur lors de la sauvegarde')
      : null;

  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Ton profil ne permet pas de consulter les forfaits.
      </div>
    );
  }

  return (
    <main className="space-y-6">
      <PlansHeroSection
        totalActive={totalActive}
        totalArchived={totalArchived}
        canManage={canManage}
        isLoading={isLoading}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
        onCreate={openCreate}
      />

      <PlansCatalogSection
        plans={plans}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        showArchived={showArchived}
        canManage={canManage}
        onEdit={openEdit}
        onDuplicate={(plan) => duplicateMutation.mutate(plan)}
        onArchive={(id) => setConfirmDeleteId(id)}
        onRestore={(id) => restoreMutation.mutate(id)}
        isDuplicating={duplicateMutation.isPending}
        isArchiving={deleteMutation.isPending || archiveMutation.isPending}
        isRestoring={restoreMutation.isPending}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Supprimer ce forfait ?"
        description="Si ce forfait n'a jamais été utilisé, il sera supprimé définitivement. S'il a déjà été utilisé, vous pourrez l'archiver à la place."
        confirmLabel="Supprimer"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <ConfirmDialog
        open={confirmArchiveId !== null}
        title="Archiver ce forfait ?"
        description="Ce forfait est déjà utilisé et ne peut pas être supprimé. Il sera archivé et retiré de la liste active. Vous pourrez le restaurer ultérieurement."
        confirmLabel="Archiver"
        isLoading={archiveMutation.isPending}
        onConfirm={() => {
          if (confirmArchiveId) archiveMutation.mutate(confirmArchiveId);
        }}
        onCancel={() => setConfirmArchiveId(null)}
      />

      {canManage && (
        <PlansFormModal
          open={showForm || editingPlan !== null}
          editingPlan={editingPlan}
          form={form}
          setForm={setForm}
          isPending={createMutation.isPending || updateMutation.isPending}
          errorMessage={mutationError}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </main>
  );
}
