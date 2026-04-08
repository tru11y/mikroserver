'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Settings, User, Shield, Server, CreditCard, Wifi, Save, Eye, EyeOff, CheckCircle, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

interface ConfigEntry {
  value: string;
  description: string;
  isSecret: boolean;
}

type Config = Record<string, ConfigEntry>;

function Section({ icon, color, title, children }: { icon: React.ReactNode; color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={clsx('p-2 rounded-lg', color)}>{icon}</div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({
  label, description, value, onChange, isSecret, disabled,
}: {
  label: string; description?: string; value: string;
  onChange: (v: string) => void; isSecret?: boolean; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isMasked = isSecret && value === '••••••••';

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="relative">
        <input
          type={isSecret && !show ? 'password' : 'text'}
          value={value}
          disabled={disabled}
          placeholder={isMasked ? '(inchangé — laisser vide pour garder)' : ''}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 pr-9"
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const user = (meData as any)?.data?.data;

  const { data: configData, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings.get(),
  });
  const config: Config = (configData as any)?.data?.data ?? {};

  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (config && Object.keys(config).length > 0 && Object.keys(form).length === 0) {
      const initial: Record<string, string> = {};
      for (const [key, entry] of Object.entries(config)) {
        initial[key] = entry.value;
      }
      setForm(initial);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.settings.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));
  const canEdit = user?.role === 'SUPER_ADMIN';

  const handleSave = () => {
    if (!canEdit) return;
    updateMutation.mutate(form);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground text-sm mt-1">Configuration complète de la plateforme</p>
          {!canEdit && (
            <p className="text-xs text-amber-500 mt-2">
              Lecture seule. Seul un super administrateur peut modifier ces paramètres.
            </p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!canEdit || updateMutation.isPending || isLoading}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            saved
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50',
          )}
        >
          {updateMutation.isPending
            ? <><RefreshCw className="h-4 w-4 animate-spin" />Sauvegarde...</>
            : saved
            ? <><CheckCircle className="h-4 w-4" />Sauvegardé</>
            : <><Save className="h-4 w-4" />Sauvegarder</>
          }
        </button>
      </div>

      {/* Profil */}
      <Section icon={<User className="h-4 w-4" />} color="bg-primary/10 text-primary" title="Profil administrateur">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Nom complet</p>
            <p className="font-medium">{user ? `${user.firstName} ${user.lastName}` : '...'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Email</p>
            <p className="font-medium">{user?.email ?? '...'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Rôle</p>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium text-primary bg-primary/10 border-primary/20">
              <Shield className="h-3 w-3" />{user?.role ?? '...'}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Dernière connexion</p>
            <p className="text-xs">{user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR') : '—'}</p>
          </div>
        </div>
      </Section>

      {/* Business */}
      <Section icon={<Settings className="h-4 w-4" />} color="bg-violet-500/10 text-violet-400" title="Informations business">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Nom de la plateforme"
            value={form['business.name'] ?? ''}
            onChange={v => set('business.name', v)}
            disabled={!canEdit}
          />
          <Field
            label="Pays"
            description="Code ISO (CI, SN, ML...)"
            value={form['business.country'] ?? ''}
            onChange={v => set('business.country', v)}
            disabled={!canEdit}
          />
          <div className="col-span-2">
            <Field
              label="Téléphone de contact"
              value={form['business.phone'] ?? ''}
              onChange={v => set('business.phone', v)}
              disabled={!canEdit}
            />
          </div>
        </div>
      </Section>

      {/* Wave */}
      <Section icon={<CreditCard className="h-4 w-4" />} color="bg-emerald-500/10 text-emerald-400" title="Compte Wave CI">
        <p className="text-xs text-muted-foreground -mt-1">
          Configurez votre compte Wave pour accepter les paiements mobile money.
          La clé API se trouve dans votre dashboard Wave → Développeurs.
        </p>
        <div className="grid grid-cols-1 gap-4">
          <Field
            label="Nom du marchand Wave"
            description="Affiché sur la page de paiement Wave"
            value={form['wave.merchant_name'] ?? ''}
            onChange={v => set('wave.merchant_name', v)}
            disabled={!canEdit}
          />
          <Field
            label="Clé API Wave"
            description="Commence par wave_sn_ ou wave_ci_"
            value={form['wave.api_key'] ?? ''}
            onChange={v => set('wave.api_key', v)}
            isSecret
            disabled={!canEdit}
          />
          <Field
            label="Secret webhook Wave"
            description="Pour vérifier la signature HMAC-SHA256 des webhooks"
            value={form['wave.webhook_secret'] ?? ''}
            onChange={v => set('wave.webhook_secret', v)}
            isSecret
            disabled={!canEdit}
          />
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
          <p className="font-medium text-muted-foreground">URL Webhook à configurer dans Wave :</p>
          <code className="font-mono text-primary select-all">
            {typeof window !== 'undefined' ? window.location.origin : 'https://votre-domaine.com'}/proxy/api/v1/webhooks/wave
          </code>
        </div>
      </Section>

      {/* Hotspot defaults */}
      <Section icon={<Wifi className="h-4 w-4" />} color="bg-amber-500/10 text-amber-400" title="Paramètres Hotspot par défaut">
        <p className="text-xs text-muted-foreground -mt-1">
          Ces valeurs sont pré-remplies lors de l'ajout d'un nouveau routeur.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Profil hotspot par défaut"
            description="Nom du profil RouterOS"
            value={form['hotspot.default_profile'] ?? ''}
            onChange={v => set('hotspot.default_profile', v)}
            disabled={!canEdit}
          />
          <Field
            label="Serveur hotspot par défaut"
            description="Nom du serveur RouterOS"
            value={form['hotspot.default_server'] ?? ''}
            onChange={v => set('hotspot.default_server', v)}
            disabled={!canEdit}
          />
        </div>
      </Section>

      {/* WireGuard info */}
      <Section icon={<Server className="h-4 w-4" />} color="bg-blue-500/10 text-blue-400" title="Infrastructure WireGuard">
        <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-muted-foreground">Serveur VPS :</span> <span className="font-mono">10.66.66.1</span></div>
            <div><span className="text-muted-foreground">Plage routeurs :</span> <span className="font-mono">10.66.66.2+</span></div>
            <div><span className="text-muted-foreground">Port API RouterOS :</span> <span className="font-mono">8728</span></div>
            <div><span className="text-muted-foreground">Protocole :</span> <span className="font-mono">WireGuard UDP</span></div>
          </div>
          <p className="text-muted-foreground pt-2 border-t border-border mt-2">
            Chaque routeur MikroTik doit être connecté via WireGuard et avoir l'API RouterOS activée sur le port 8728.
          </p>
        </div>
      </Section>

      {updateMutation.isError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          Erreur : {(updateMutation.error as any)?.response?.data?.message ?? 'Impossible de sauvegarder'}
        </p>
      )}
    </div>
  );
}
