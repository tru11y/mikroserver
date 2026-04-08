'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Wifi, WifiOff, Plus, RefreshCw, ChevronRight,
  MapPin, Server, Activity, Clock, Pencil, Trash2, X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Router {
  id: string;
  name: string;
  description?: string;
  location?: string;
  wireguardIp: string;
  apiPort: number;
  apiUsername: string;
  hotspotProfile: string;
  hotspotServer: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'MAINTENANCE';
  lastSeenAt?: string;
  createdAt: string;
}

interface CreateRouterForm {
  name: string;
  wireguardIp: string;
  apiUsername: string;
  apiPassword: string;
  location: string;
  description: string;
  apiPort: number;
}

const STATUS_CONFIG = {
  ONLINE:      { label: 'En ligne',      color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' },
  OFFLINE:     { label: 'Hors ligne',    color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/20',         dot: 'bg-red-400' },
  DEGRADED:    { label: 'Dégradé',       color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/20',     dot: 'bg-amber-400' },
  MAINTENANCE: { label: 'Maintenance',   color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/20',       dot: 'bg-blue-400' },
};

export default function RoutersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateRouterForm>({
    name: '', wireguardIp: '', apiUsername: 'admin', apiPassword: '',
    location: '', description: '', apiPort: 8728,
  });
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [editingRouter, setEditingRouter] = useState<Router | null>(null);
  const [editForm, setEditForm] = useState({ name: '', location: '', description: '', hotspotProfile: '', hotspotServer: '', apiUsername: '', apiPassword: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['routers'],
    queryFn: () => api.routers.list(),
    refetchInterval: 30_000,
  });

  const routers: Router[] = (data as any)?.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (d: CreateRouterForm) => api.routers.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routers'] });
      setShowForm(false);
      setForm({ name: '', wireguardIp: '', apiUsername: 'admin', apiPassword: '', location: '', description: '', apiPort: 8728 });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) => api.routers.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routers'] });
      setEditingRouter(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.routers.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routers'] });
      setDeletingId(null);
    },
  });

  const openEdit = (r: Router, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditForm({ name: r.name, location: r.location ?? '', description: r.description ?? '', hotspotProfile: r.hotspotProfile, hotspotServer: r.hotspotServer, apiUsername: r.apiUsername, apiPassword: '' });
    setEditingRouter(r);
  };

  const handleHealthCheck = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckingId(id);
    try {
      await api.routers.healthCheck(id);
      await queryClient.invalidateQueries({ queryKey: ['routers'] });
    } finally {
      setCheckingId(null);
    }
  };

  const onlineCount = routers.filter(r => r.status === 'ONLINE').length;
  const offlineCount = routers.filter(r => r.status === 'OFFLINE').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Routeurs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {routers.length} routeur{routers.length !== 1 ? 's' : ''} · {onlineCount} en ligne · {offlineCount} hors ligne
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted transition-colors text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Ajouter un routeur
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: routers.length, icon: Server, color: 'text-foreground' },
          { label: 'En ligne', value: onlineCount, icon: Wifi, color: 'text-emerald-400' },
          { label: 'Hors ligne', value: offlineCount, icon: WifiOff, color: 'text-red-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-card p-4 flex items-center gap-4">
            <div className={clsx('p-2 rounded-lg bg-muted', color)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Router list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : routers.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Wifi className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-medium">Aucun routeur configuré</p>
          <p className="text-muted-foreground text-sm mt-1">Ajoutez votre premier routeur MikroTik pour commencer</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            Ajouter un routeur
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {routers.map((r) => {
            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.OFFLINE;
            return (
              <div
                key={r.id}
                onClick={() => router.push(`/routers/${r.id}`)}
                className="group rounded-xl border bg-card p-5 flex items-center gap-5 hover:border-primary/50 hover:bg-card/80 cursor-pointer transition-all"
              >
                {/* Status icon */}
                <div className={clsx('p-3 rounded-xl border', cfg.bg)}>
                  {r.status === 'ONLINE'
                    ? <Wifi className={clsx('h-6 w-6', cfg.color)} />
                    : <WifiOff className={clsx('h-6 w-6', cfg.color)} />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-base truncate">{r.name}</span>
                    <span className={clsx('flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium', cfg.bg, cfg.color)}>
                      <span className={clsx('h-1.5 w-1.5 rounded-full', cfg.dot, r.status === 'ONLINE' && 'animate-pulse')} />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {r.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {r.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Server className="h-3 w-3" /> {r.wireguardIp}:{r.apiPort}
                    </span>
                    {r.lastSeenAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Vu {formatDistanceToNow(new Date(r.lastSeenAt), { addSuffix: true, locale: fr })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleHealthCheck(r.id, e)}
                    disabled={checkingId === r.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <Activity className={clsx('h-3.5 w-3.5', checkingId === r.id && 'animate-spin')} />
                    {checkingId === r.id ? 'Test...' : 'Ping'}
                  </button>
                  <button
                    onClick={(e) => openEdit(r, e)}
                    className="p-1.5 rounded-lg border hover:bg-muted transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingId(r.id); }}
                    className="p-1.5 rounded-lg border hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Router Modal */}
      {editingRouter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border bg-card shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Modifier le routeur</h2>
                <p className="text-sm text-muted-foreground mt-1">{editingRouter.name}</p>
              </div>
              <button onClick={() => setEditingRouter(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Nom *', key: 'name', col: 2, placeholder: 'Routeur-Plateau-01' },
                { label: 'Localisation', key: 'location', col: 1, placeholder: 'Abidjan - Plateau' },
                { label: 'Description', key: 'description', col: 1, placeholder: 'Description' },
                { label: 'Profil hotspot', key: 'hotspotProfile', col: 1, placeholder: 'default' },
                { label: 'Serveur hotspot', key: 'hotspotServer', col: 1, placeholder: 'hotspot1' },
                { label: 'Utilisateur API', key: 'apiUsername', col: 1, placeholder: 'admin' },
                { label: 'Nouveau mot de passe API', key: 'apiPassword', col: 1, placeholder: 'Laisser vide = inchangé', password: true },
              ].map(({ label, key, col, placeholder, password }) => (
                <div key={key} className={`${col === 2 ? 'col-span-2' : ''} space-y-1.5`}>
                  <label className="text-sm font-medium">{label}</label>
                  <input
                    type={password ? 'password' : 'text'}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={placeholder}
                    value={editForm[key as keyof typeof editForm]}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {editMutation.isError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {(editMutation.error as any)?.response?.data?.message ?? 'Erreur'}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingRouter(null)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">Annuler</button>
              <button
                onClick={() => editMutation.mutate({ id: editingRouter.id, data: editForm })}
                disabled={editMutation.isPending || !editForm.name}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {editMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border bg-card shadow-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold">Supprimer le routeur ?</h2>
            <p className="text-sm text-muted-foreground">Cette action est irréversible. Le routeur sera désactivé et toutes ses données associées seront conservées.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">Annuler</button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {deleteMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Router Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border bg-card shadow-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold">Ajouter un routeur MikroTik</h2>
              <p className="text-sm text-muted-foreground mt-1">Configurez la connexion via WireGuard + RouterOS API</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Nom du routeur *</label>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="ex: Routeur-Plateau-01"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">IP WireGuard *</label>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="10.66.66.2"
                  value={form.wireguardIp}
                  onChange={e => setForm(f => ({ ...f, wireguardIp: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Port API</label>
                <input
                  type="number"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.apiPort}
                  onChange={e => setForm(f => ({ ...f, apiPort: parseInt(e.target.value) || 8728 }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Utilisateur API *</label>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="admin"
                  value={form.apiUsername}
                  onChange={e => setForm(f => ({ ...f, apiUsername: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Mot de passe API *</label>
                <input
                  type="password"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.apiPassword}
                  onChange={e => setForm(f => ({ ...f, apiPassword: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Localisation</label>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="ex: Abidjan - Plateau"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Description</label>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Description optionnelle"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            {createMutation.isError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                Erreur : {(createMutation.error as any)?.response?.data?.message ?? 'Impossible d\'ajouter le routeur'}
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
                disabled={createMutation.isPending || !form.name || !form.wireguardIp || !form.apiPassword}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
              >
                {createMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
