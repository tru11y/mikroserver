'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError, unwrap } from '@/lib/api';
import type { ApiKeyItem, CreatedApiKey } from '@/lib/api/api-keys';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { clsx } from 'clsx';

const AVAILABLE_PERMISSIONS = [
  { value: 'vouchers:read', label: 'Lire les vouchers' },
  { value: 'vouchers:create', label: 'Créer des vouchers' },
  { value: 'sessions:read', label: 'Lire les sessions' },
  { value: 'customers:read', label: 'Lire les clients' },
  { value: 'routers:read', label: 'Lire les routeurs' },
] as const;

function PermissionBadge({ permission }: { permission: string }) {
  const found = AVAILABLE_PERMISSIONS.find((p) => p.value === permission);
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
      {found?.label ?? permission}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function NewKeyBanner({ rawKey, onDismiss }: { rawKey: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
            Copiez votre clé maintenant
          </p>
          <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80 mt-0.5">
            Cette clé ne sera affichée qu&apos;une seule fois. Conservez-la en lieu sûr.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-background border px-3 py-2">
        <code className="flex-1 text-xs font-mono text-foreground break-all select-all">
          {rawKey}
        </code>
        <button
          onClick={handleCopy}
          className={clsx(
            'flex-shrink-0 p-1.5 rounded-md transition-colors',
            copied
              ? 'text-green-500 bg-green-500/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
          title="Copier la clé"
        >
          {copied ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      <button
        onClick={onDismiss}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        J&apos;ai copié ma clé, fermer
      </button>
    </div>
  );
}

function ApiKeyRow({
  apiKey,
  onRevoke,
  isRevoking,
}: {
  apiKey: ApiKeyItem;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}) {
  const isExpired = apiKey.expiresAt ? new Date(apiKey.expiresAt) < new Date() : false;

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex-shrink-0">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Key className="h-4 w-4 text-primary" />
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{apiKey.name}</span>
          {!apiKey.isActive || isExpired ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
              {isExpired ? 'Expirée' : 'Révoquée'}
            </span>
          ) : (
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
              Active
            </span>
          )}
        </div>

        <code className="text-xs font-mono text-muted-foreground">{apiKey.keyPrefix}••••••••</code>

        <div className="flex flex-wrap gap-1 pt-0.5">
          {apiKey.permissions.map((p) => (
            <PermissionBadge key={p} permission={p} />
          ))}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground pt-1">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Créée le {formatDate(apiKey.createdAt)}
          </span>
          {apiKey.lastUsedAt && (
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Dernière utilisation : {formatDate(apiKey.lastUsedAt)}
            </span>
          )}
          {apiKey.expiresAt && (
            <span className={clsx('flex items-center gap-1', isExpired && 'text-destructive')}>
              <AlertTriangle className="h-3 w-3" />
              Expire le {formatDate(apiKey.expiresAt)}
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0">
        <button
          onClick={() => onRevoke(apiKey.id)}
          disabled={isRevoking || !apiKey.isActive || isExpired}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            apiKey.isActive && !isExpired
              ? 'text-destructive hover:bg-destructive/10 border border-destructive/30'
              : 'text-muted-foreground border border-border cursor-not-allowed opacity-50',
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Révoquer
        </button>
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [newRawKey, setNewRawKey] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.apiKeys.list(),
  });

  const keys: ApiKeyItem[] = (data as any)?.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      api.apiKeys.create({
        name,
        permissions: selectedPerms,
        expiresAt: expiresAt || undefined,
      }),
    onSuccess: (res) => {
      const created: CreatedApiKey = (res as any)?.data?.data ?? res;
      setNewRawKey(created.rawKey);
      setName('');
      setSelectedPerms([]);
      setExpiresAt('');
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.apiKeys.revoke(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const togglePermission = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedPerms.length === 0) return;
    createMutation.mutate();
  };

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Clés API</h1>
            <p className="text-sm text-muted-foreground">
              Intégrez des systèmes externes (POS, applications revendeurs…)
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Créer une clé API
        </button>
      </div>

      {/* New key banner */}
      {newRawKey && (
        <NewKeyBanner rawKey={newRawKey} onDismiss={() => setNewRawKey(null)} />
      )}

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border bg-card p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold">Nouvelle clé API</h2>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Nom de la clé <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : POS Boutique Cocody"
              required
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Permissions */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Permissions <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_PERMISSIONS.map((perm) => (
                <label
                  key={perm.value}
                  className={clsx(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                    selectedPerms.includes(perm.value)
                      ? 'border-primary/50 bg-primary/5'
                      : 'hover:bg-muted',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedPerms.includes(perm.value)}
                    onChange={() => togglePermission(perm.value)}
                    className="accent-primary"
                  />
                  <span className="text-xs font-medium">{perm.label}</span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                    {perm.value}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Date d&apos;expiration (optionnel)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {createMutation.isError && (
            <p className="text-xs text-destructive">
              {apiError(createMutation.error, 'Erreur lors de la création')}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim() || selectedPerms.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Création…' : 'Créer la clé'}
            </button>
          </div>
        </form>
      )}

      {/* Key list */}
      <div className="space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 rounded-xl border bg-card animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && keys.length === 0 && (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center space-y-2">
            <Key className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">Aucune clé API pour le moment</p>
            <p className="text-xs text-muted-foreground/70">
              Créez une clé pour intégrer un système externe.
            </p>
          </div>
        )}

        {keys.map((k) => (
          <ApiKeyRow
            key={k.id}
            apiKey={k}
            onRevoke={(id) => revokeMutation.mutate(id)}
            isRevoking={revokeMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}
