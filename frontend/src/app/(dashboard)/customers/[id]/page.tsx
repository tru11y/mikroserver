'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Wifi, Calendar, Database, ShoppingBag, Shield, ShieldOff, Edit2, Save, X, WifiOff, Trash2 } from 'lucide-react';
import { customersApi } from '@/lib/api/customers';
import { sessionsApi } from '@/lib/api/sessions';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

function formatBytes(bytes: string | number) {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatXof(n: number) {
  return new Intl.NumberFormat('fr-CI', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', notes: '' });

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const res = await customersApi.findOne(id);
      const c = (res.data as unknown as { data: ReturnType<typeof Object> }).data as {
        id: string; macAddress: string; firstSeenAt: string; lastSeenAt: string;
        totalSessions: number; totalDataBytes: string; totalSpentXof: number;
        isBlocked: boolean; firstName: string | null; lastName: string | null;
        phone: string | null; notes: string | null; lastUsername: string | null;
        router: { id: string; name: string };
      };
      setForm({
        firstName: c.firstName ?? '',
        lastName: c.lastName ?? '',
        phone: c.phone ?? '',
        notes: c.notes ?? '',
      });
      return c;
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => customersApi.update(id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', id] });
      setEditing(false);
    },
  });

  const blockMutation = useMutation({
    mutationFn: (isBlocked: boolean) => customersApi.block(id, isBlocked),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => customersApi.delete(id),
    onSuccess: () => router.push('/customers'),
    onError: () => toast.error('Échec de la suppression'),
  });

  const { data: activeSessions } = useQuery({
    queryKey: ['customer-sessions', id, customer?.macAddress],
    queryFn: async () => {
      if (!customer?.macAddress) return [];
      const res = await sessionsApi.byMac(customer.macAddress, customer.router.id);
      return (res.data as unknown as { id: string; mikrotikId: string | null; ipAddress: string | null; macAddress: string | null; startedAt: string; router: { id: string; name: string }; voucher: { code: string; plan: { name: string } | null } | null }[]);
    },
    enabled: !!customer?.macAddress,
    refetchInterval: 30000,
  });

  const disconnectMutation = useMutation({
    mutationFn: (sessionId: string) => sessionsApi.forceDisconnect(sessionId),
    onSuccess: () => {
      toast.success('Session déconnectée');
      qc.invalidateQueries({ queryKey: ['customer-sessions', id] });
    },
    onError: () => toast.error('Échec de la déconnexion'),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Chargement...</div>;
  if (!customer) return <div className="p-6 text-muted-foreground">Client introuvable.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour aux clients
      </button>

      {/* Header */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold font-mono">{customer.macAddress}</p>
              {customer.isBlocked && (
                <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">Bloqué</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <Wifi className="h-3.5 w-3.5" /> {customer.router.name}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => blockMutation.mutate(!customer.isBlocked)}
              disabled={blockMutation.isPending}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                customer.isBlocked
                  ? 'border-green-500 text-green-600 hover:bg-green-500/10'
                  : 'border-destructive text-destructive hover:bg-destructive/10'
              }`}
            >
              {customer.isBlocked ? <><ShieldOff className="h-4 w-4" /> Débloquer</> : <><Shield className="h-4 w-4" /> Bloquer</>}
            </button>
            <button
              onClick={() => { if (confirm('Supprimer ce client ?')) deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Supprimer
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <p className="text-2xl font-bold">{customer.totalSessions}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <ShoppingBag className="h-3 w-3" /> Sessions
            </p>
          </div>
          <div className="text-center border-x">
            <p className="text-2xl font-bold">{formatBytes(customer.totalDataBytes)}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <Database className="h-3 w-3" /> Data utilisée
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{formatXof(customer.totalSpentXof)}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <ShoppingBag className="h-3 w-3" /> Total dépensé
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-card border rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Activité</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-primary" />
            <div>
              <span className="font-medium">Première connexion</span>
              <span className="text-muted-foreground ml-2">
                {format(new Date(customer.firstSeenAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-green-500" />
            <div>
              <span className="font-medium">Dernière activité</span>
              <span className="text-muted-foreground ml-2">
                {formatDistanceToNow(new Date(customer.lastSeenAt), { addSuffix: true, locale: fr })}
              </span>
            </div>
          </div>
          {customer.lastUsername && (
            <div className="flex items-center gap-3 text-sm">
              <Wifi className="h-4 w-4 text-blue-500" />
              <div>
                <span className="font-medium">Dernier identifiant utilisé</span>
                <span className="font-mono text-muted-foreground ml-2">{customer.lastUsername}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Sessions */}
      {activeSessions && activeSessions.length > 0 && (
        <div className="bg-card border rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Wifi className="h-4 w-4 text-green-500" /> Sessions actives
          </h2>
          <div className="space-y-2">
            {activeSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
                <div className="space-y-0.5">
                  <p className="font-mono text-xs text-muted-foreground">{session.ipAddress ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {session.voucher?.plan?.name ?? 'Voucher'} &middot; {session.voucher?.code ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Depuis {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true, locale: fr })}
                  </p>
                </div>
                <button
                  onClick={() => disconnectMutation.mutate(session.id)}
                  disabled={disconnectMutation.isPending}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  <WifiOff className="h-3.5 w-3.5" /> Déconnecter
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit profile */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Informations client</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-sm text-primary hover:underline">
              <Edit2 className="h-3.5 w-3.5" /> Modifier
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-1 rounded-lg"
              >
                <Save className="h-3.5 w-3.5" /> {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-sm border px-3 py-1 rounded-lg hover:bg-muted">
                <X className="h-3.5 w-3.5" /> Annuler
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'firstName', label: 'Prénom' },
              { key: 'lastName', label: 'Nom' },
              { key: 'phone', label: 'Téléphone' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-medium">{label}</label>
                <input
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            ))}
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Prénom', value: customer.firstName },
              { label: 'Nom', value: customer.lastName },
              { label: 'Téléphone', value: customer.phone },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm mt-0.5">{value ?? <span className="text-muted-foreground italic">Non renseigné</span>}</p>
              </div>
            ))}
            {customer.notes && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm mt-0.5">{customer.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
