'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Tag, Plus, RefreshCw, Clock, Wifi, Archive, Pencil, Star } from 'lucide-react';
import { clsx } from 'clsx';

interface Plan {
  id: string;
  name: string;
  description?: string;
  slug: string;
  priceXof: number;
  durationMinutes: number;
  downloadKbps?: number;
  uploadKbps?: number;
  dataLimitMb?: number;
  userProfile?: string;
  displayOrder?: number;
  isPopular?: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
}

interface CreatePlanForm {
  name: string;
  description: string;
  priceXof: number;
  durationMinutes: number;
  downloadKbps: number;
  uploadKbps: number;
  dataLimitMb: number;
  userProfile: string;
  displayOrder: number;
  isPopular: boolean;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} j`;
}

function formatSpeed(kbps?: number): string {
  if (!kbps) return '—';
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(0)} Mbps`;
  return `${kbps} Kbps`;
}

function normalizePlanPayload(form: CreatePlanForm) {
  return {
    ...form,
    description: form.description || undefined,
    downloadKbps: form.downloadKbps > 0 ? form.downloadKbps : undefined,
    uploadKbps: form.uploadKbps > 0 ? form.uploadKbps : undefined,
    dataLimitMb: form.dataLimitMb > 0 ? form.dataLimitMb : undefined,
    userProfile: form.userProfile || undefined,
  };
}

export default function PlansPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<CreatePlanForm>({
    name: '',
    description: '',
    priceXof: 500,
    durationMinutes: 60,
    downloadKbps: 2048,
    uploadKbps: 1024,
    dataLimitMb: 0,
    userProfile: 'default',
    displayOrder: 0,
    isPopular: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['plans', showArchived],
    queryFn: () => api.plans.list(showArchived),
  });

  const plans: Plan[] = (data as any)?.data?.data ?? (data as any)?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (d: CreatePlanForm) => api.plans.create(normalizePlanPayload(d)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setShowForm(false);
      setForm({
        name: '',
        description: '',
        priceXof: 500,
        durationMinutes: 60,
        downloadKbps: 2048,
        uploadKbps: 1024,
        dataLimitMb: 0,
        userProfile: 'default',
        displayOrder: 0,
        isPopular: false,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreatePlanForm }) => api.plans.update(id, normalizePlanPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setEditingPlan(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.plans.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans'] }),
  });

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description ?? '',
      priceXof: plan.priceXof,
      durationMinutes: plan.durationMinutes,
      downloadKbps: plan.downloadKbps ?? 0,
      uploadKbps: plan.uploadKbps ?? 0,
      dataLimitMb: plan.dataLimitMb ?? 0,
      userProfile: plan.userProfile ?? 'default',
      displayOrder: plan.displayOrder ?? 0,
      isPopular: Boolean(plan.isPopular),
    });
  };

  const formContent = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Nom du forfait *</label>
        <input
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="ex: 1 heure - 500 FCFA"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Description</label>
        <input
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Description courte"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Prix (FCFA) *</label>
          <input type="number" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.priceXof} onChange={e => setForm(f => ({ ...f, priceXof: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Durée (minutes) *</label>
          <input type="number" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Download (Kbps)</label>
          <input type="number" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.downloadKbps} onChange={e => setForm(f => ({ ...f, downloadKbps: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Upload (Kbps)</label>
          <input type="number" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.uploadKbps} onChange={e => setForm(f => ({ ...f, uploadKbps: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Quota data (MB)</label>
          <input type="number" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.dataLimitMb} onChange={e => setForm(f => ({ ...f, dataLimitMb: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Profil hotspot</label>
          <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.userProfile} onChange={e => setForm(f => ({ ...f, userProfile: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Ordre d'affichage</label>
          <input type="number" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium pt-8">
          <input type="checkbox" checked={form.isPopular} onChange={e => setForm(f => ({ ...f, isPopular: e.target.checked }))} className="h-4 w-4 rounded border-border" />
          Forfait populaire
        </label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Forfaits</h1>
          <p className="text-muted-foreground text-sm mt-1">{plans.length} forfait{plans.length !== 1 ? 's' : ''} configuré{plans.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 rounded border-border" />
            Voir archivés
          </label>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Nouveau forfait
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-medium">Aucun forfait configuré</p>
          <p className="text-muted-foreground text-sm mt-1">Créez des forfaits WiFi pour vos clients</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border bg-card p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{plan.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {plan.isPopular && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                        <Star className="h-3 w-3" />
                        Populaire
                      </span>
                    )}
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full border font-medium',
                      plan.status === 'ACTIVE'
                        ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                        : 'text-muted-foreground bg-muted border-border',
                    )}>
                      {plan.status === 'ACTIVE' ? 'Actif' : 'Archivé'}
                    </span>
                  </div>
                </div>

                <p className="text-3xl font-bold tabular-nums mb-1">
                  {plan.priceXof.toLocaleString('fr-FR')}
                  <span className="text-base font-medium text-muted-foreground ml-1">FCFA</span>
                </p>

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatDuration(plan.durationMinutes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Wifi className="h-3 w-3" /> ↓{formatSpeed(plan.downloadKbps)} ↑{formatSpeed(plan.uploadKbps)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  <p>Profil: {plan.userProfile ?? 'default'}</p>
                  <p>Quota: {plan.dataLimitMb ? `${plan.dataLimitMb} MB` : 'Illimité'}</p>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => openEdit(plan)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Modifier
                  </button>
                  {plan.status === 'ACTIVE' && (
                    <button
                      onClick={() => archiveMutation.mutate(plan.id)}
                      disabled={archiveMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      <Archive className="h-3 w-3" />
                      Archiver
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card shadow-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold">Nouveau forfait</h2>
              <p className="text-sm text-muted-foreground mt-1">Configurez le prix, la durée et les limites de bande passante</p>
            </div>
            {formContent}

            {createMutation.isError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {(createMutation.error as any)?.response?.data?.message ?? 'Erreur lors de la création'}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.name || form.priceXof <= 0}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
              >
                {createMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card shadow-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold">Modifier le forfait</h2>
              <p className="text-sm text-muted-foreground mt-1">{editingPlan.slug}</p>
            </div>
            {formContent}
            {updateMutation.isError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {(updateMutation.error as any)?.response?.data?.message ?? 'Erreur lors de la mise à jour'}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingPlan(null)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">
                Annuler
              </button>
              <button
                onClick={() => updateMutation.mutate({ id: editingPlan.id, data: form })}
                disabled={updateMutation.isPending || !form.name || form.priceXof <= 0}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
              >
                {updateMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
