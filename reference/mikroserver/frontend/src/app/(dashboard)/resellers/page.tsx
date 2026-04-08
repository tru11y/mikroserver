'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Users,
  Plus,
  X,
  ShieldOff,
  ShieldCheck,
  Trash2,
  Mail,
  Phone,
  AlertCircle,
  Clock3,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Reseller {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  lastLoginAt: string | null;
  createdAt: string;
}

const statusConfig = {
  ACTIVE: { label: 'Actif', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  SUSPENDED: { label: 'Suspendu', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  PENDING_VERIFICATION: { label: 'En attente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

type FormData = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone: string;
};

const emptyForm: FormData = { email: '', firstName: '', lastName: '', password: '', phone: '' };

export default function ResellersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', 'resellers'],
    queryFn: () => api.users.resellers(),
    refetchInterval: 30_000,
  });

  const resellers: Reseller[] = (data?.data?.data as Reseller[]) ?? [];

  const createMutation = useMutation({
    mutationFn: () => api.users.create({ ...form, role: 'RESELLER' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'resellers'] });
      setShowForm(false);
      setForm(emptyForm);
      setFormError(null);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setFormError(e?.response?.data?.message ?? 'Erreur lors de la création');
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.users.suspend(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', 'resellers'] }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.users.activate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', 'resellers'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.users.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'resellers'] });
      setDeletingId(null);
    },
  });

  const activeCount = resellers.filter((reseller) => reseller.status === 'ACTIVE').length;
  const suspendedCount = resellers.filter((reseller) => reseller.status === 'SUSPENDED').length;
  const recentlyActiveCount = resellers.filter((reseller) => {
    if (!reseller.lastLoginAt) return false;
    return Date.now() - new Date(reseller.lastLoginAt).getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Revendeurs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez les comptes revendeurs qui génèrent des tickets
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau revendeur
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="mt-2 text-3xl font-bold">{resellers.length}</p>
          <p className="text-xs text-muted-foreground mt-1">comptes revendeurs</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Actifs</p>
          <p className="mt-2 text-3xl font-bold text-emerald-500">{activeCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{suspendedCount} suspendu{ suspendedCount !== 1 ? 's' : '' }</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Connexions</p>
          <p className="mt-2 text-3xl font-bold">{recentlyActiveCount}</p>
          <p className="text-xs text-muted-foreground mt-1">actifs sur les 7 derniers jours</p>
        </div>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Créer un revendeur</h2>
              <button onClick={() => { setShowForm(false); setFormError(null); }}>
                <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {(['firstName', 'lastName'] as const).map((field) => (
                <input
                  key={field}
                  placeholder={field === 'firstName' ? 'Prénom' : 'Nom'}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="px-3 py-2 rounded-lg border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ))}
            </div>
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              placeholder="Téléphone (optionnel)"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="password"
              placeholder="Mot de passe (12+ caractères)"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? 'Création...' : 'Créer le compte'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : resellers.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Aucun revendeur créé pour l&apos;instant
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dernière connexion</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Inscrit le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {resellers.map((r) => {
                const sc = statusConfig[r.status] ?? statusConfig.ACTIVE;
                return (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {r.email}
                      </div>
                      {r.phone && (
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                          <Phone className="h-3 w-3" />
                          {r.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', sc.cls)}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {r.lastLoginAt ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {new Date(r.lastLoginAt).toLocaleString('fr-FR')}
                        </span>
                      ) : 'Jamais'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(r.createdAt).toLocaleDateString('fr-CI')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {r.status === 'ACTIVE' ? (
                          <button
                            onClick={() => suspendMutation.mutate(r.id)}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                            title="Suspendre"
                          >
                            <ShieldOff className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => activateMutation.mutate(r.id)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                            title="Réactiver"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingId(r.id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Supprimer le revendeur</h2>
              <button onClick={() => setDeletingId(null)}>
                <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Le compte sera désactivé et masqué du tableau de bord.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
