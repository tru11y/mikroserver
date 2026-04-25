'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Monitor,
  Globe,
  Terminal,
  Wifi,
  WifiOff,
  Loader2,
  Pencil,
  X,
  Save,
  Network,
  Zap,
  Download,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { api, unwrap, apiError } from '@/lib/api';
import type { RouterAccessCredentials } from './router-detail.types';

// ─── Port-map types ───────────────────────────────────────────────────────────

interface PortMapInfo {
  rulesActive: boolean;
  vpnIp: string;
  webfig: { url: string; port: number };
  winbox: { address: string; port: number; deepLink: string };
  ssh: { command: string; host: string; port: number };
  credentials: { username: string };
}

interface PortTestResult {
  reachable: boolean;
  latencyMs: number;
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isHttpNotFound(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

// ─── Inline copy button (with text label) ─────────────────────────────────────

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
    >
      {copied ? (
        <><Check className="h-3.5 w-3.5 text-emerald-400" /><span className="text-emerald-400">Copié !</span></>
      ) : (
        <><Copy className="h-3.5 w-3.5" /><span>Copier</span></>
      )}
    </button>
  );
}

// ─── Port-map status badge ────────────────────────────────────────────────────

function PortTestBadge({ test }: { test?: PortTestResult }) {
  if (!test) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
        Test…
      </span>
    );
  }
  return test.reachable ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-400 ring-1 ring-emerald-500/20">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      En ligne · {test.latencyMs}ms
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs text-red-400 ring-1 ring-red-500/20">
      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
      Hors ligne
    </span>
  );
}

// ─── Public port-map card ────────────────────────────────────────────────────

function PublicAccessSection({ routerId }: { routerId: string }) {
  const queryClient = useQueryClient();
  const [allocateError, setAllocateError] = useState<string | null>(null);
  const mobile = isMobileDevice();

  const { data: portMap, isLoading, error } = useQuery({
    queryKey: ['router-port-map', routerId],
    queryFn: async () => {
      const res = await api.routers.portMap(routerId);
      return unwrap<PortMapInfo>(res);
    },
    retry: (failureCount, err) => !isHttpNotFound(err) && failureCount < 1,
  });

  const { data: testResult } = useQuery({
    queryKey: ['router-port-map-test', routerId],
    queryFn: async () => {
      const res = await api.routers.testPortMap(routerId);
      return unwrap<PortTestResult>(res);
    },
    enabled: Boolean(portMap?.rulesActive),
    refetchInterval: 30_000,
    retry: false,
  });

  const allocateMutation = useMutation({
    mutationFn: () => api.routers.allocatePortMap(routerId),
    onMutate: () => setAllocateError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['router-port-map', routerId] }),
    onError: (err) => setAllocateError(apiError(err, "Échec de l'allocation des ports")),
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2 animate-pulse">
        <div className="h-4 w-36 rounded bg-zinc-800" />
        <div className="h-20 rounded bg-zinc-800" />
      </div>
    );
  }

  // Not configured
  if (!portMap || isHttpNotFound(error)) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Network className="h-4 w-4 text-zinc-400" />
              Accès public (ports DNAT)
            </h4>
            <p className="mt-1 text-xs text-zinc-500">
              Alloue des ports publics sur le VPS pour accéder sans VPN via Winbox, WebFig ou SSH.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {allocateError && (
              <p className="text-xs text-red-400">{allocateError}</p>
            )}
            <button
              type="button"
              disabled={allocateMutation.isPending}
              onClick={() => allocateMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
            >
              {allocateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Activer l&apos;accès distant
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-zinc-900/60 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Network className="h-4 w-4 text-indigo-400" />
          Accès public (ports DNAT)
        </h4>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
            portMap.rulesActive
              ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${portMap.rulesActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {portMap.rulesActive ? 'Règles actives' : 'Règles inactives'}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Winbox */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Monitor className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-semibold text-zinc-300">Winbox / App</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="rounded bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-200">{portMap.winbox.address}</span>
            <CopyText text={portMap.winbox.address} />
          </div>
          <p className="text-[10px] text-zinc-500">Collez dans Winbox.exe → Connect</p>
          {mobile ? (
            <a
              href={portMap.winbox.deepLink}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              <Smartphone className="h-3.5 w-3.5" />
              MikroTik App
            </a>
          ) : (
            <a
              href="https://mikrotik.com/download"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger Winbox
            </a>
          )}
        </div>

        {/* WebFig */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-xs font-semibold text-zinc-300">WebFig (navigateur)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="truncate rounded bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-200">{portMap.webfig.url}</span>
            <CopyText text={portMap.webfig.url} />
          </div>
          <p className="text-[10px] text-zinc-500">Accès direct sans VPN</p>
          <button
            type="button"
            onClick={() => window.open(portMap.webfig.url, '_blank', 'noopener,noreferrer')}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ouvrir WebFig
          </button>
        </div>

        {/* SSH */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-zinc-300">SSH Terminal</span>
            </div>
            <PortTestBadge test={testResult} />
          </div>
          <div className="flex items-center gap-1">
            <span className="truncate rounded bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-200">{portMap.ssh.command}</span>
            <CopyText text={portMap.ssh.command} />
          </div>
          <p className="text-[10px] text-zinc-500">Port {portMap.ssh.port} · WireGuard</p>
        </div>
      </div>
    </div>
  );
}

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1 rounded p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
      title="Copier"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── Password field ───────────────────────────────────────────────────────────

function PasswordField({ value, fieldId }: { value: string | null; fieldId: string }) {
  const [visible, setVisible] = useState(false);
  const display = value ?? '—';

  return (
    <span className="flex items-center gap-1">
      <span className="font-mono text-xs text-zinc-200">
        {visible ? display : display !== '—' ? '••••••••' : '—'}
      </span>
      {value && (
        <>
          <button
            type="button"
            id={fieldId}
            onClick={() => setVisible((v) => !v)}
            className="rounded p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
            title={visible ? 'Masquer' : 'Afficher'}
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          {visible && <CopyButton value={value} />}
        </>
      )}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function ConnectionBadge({ routerId }: { routerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['router-access-test', routerId],
    queryFn: () => api.routers.testAccess(routerId),
    select: (r) => unwrap<{ reachable: boolean; latencyMs: number }>(r),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  if (isLoading) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Test en cours…
      </span>
    );
  }

  const reachable = data?.reachable ?? false;
  const latency = data?.latencyMs;

  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        reachable
          ? 'bg-emerald-500/15 text-emerald-300'
          : 'bg-red-500/15 text-red-400'
      }`}
    >
      {reachable ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      {reachable ? `Joignable${latency != null ? ` · ${latency}ms` : ''}` : 'Injoignable'}
    </span>
  );
}

// ─── Edit credentials modal / inline form ────────────────────────────────────

function EditForm({
  routerId,
  creds,
  onClose,
}: {
  routerId: string;
  creds: RouterAccessCredentials;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [winboxPort, setWinboxPort] = useState(String(creds.winbox.port));
  const [webfigPort, setWebfigPort] = useState(String(creds.webfig.port));
  const [sshPort, setSshPort] = useState(String(creds.ssh.port));
  const [username, setUsername] = useState(creds.winbox.username);
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.routers.updateAccess(routerId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['router-access', routerId] });
      onClose();
    },
  });

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      winboxPort: Number(winboxPort),
      webfigPort: Number(webfigPort),
      sshPort: Number(sshPort),
      accessUsername: username,
    };
    if (password) payload.accessPassword = password;
    mutation.mutate(payload);
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">
      <p className="text-sm font-medium text-zinc-200">Modifier les paramètres d&apos;accès</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Port Winbox', value: winboxPort, onChange: setWinboxPort },
          { label: 'Port WebFig', value: webfigPort, onChange: setWebfigPort },
          { label: 'Port SSH', value: sshPort, onChange: setSshPort },
        ].map(({ label, value, onChange }) => (
          <label key={label} className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">{label}</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Nom d&apos;utilisateur</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Mot de passe (laisser vide = inchangé)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Annuler
        </button>
        {mutation.isError && (
          <span className="text-xs text-red-400">Erreur lors de la mise à jour</span>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-zinc-900 h-28" />
      ))}
    </div>
  );
}

// ─── Access block ─────────────────────────────────────────────────────────────

interface BlockProps {
  icon: React.ReactNode;
  title: string;
  accentClass: string;
  rows: Array<{ label: string; value: string | null; copyable?: boolean; secret?: boolean; id?: string }>;
  action?: React.ReactNode;
}

function AccessBlock({ icon, title, accentClass, rows, action }: BlockProps) {
  return (
    <div className={`rounded-xl border ${accentClass} bg-zinc-900/60 p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-sm text-zinc-100">{title}</span>
        </div>
        {action}
      </div>
      <dl className="space-y-1.5">
        {rows.map(({ label, value, copyable, secret, id }) => (
          <div key={label} className="flex items-center justify-between text-xs gap-2">
            <dt className="text-zinc-500 shrink-0">{label}</dt>
            <dd className="flex items-center gap-1 text-right">
              {secret ? (
                <PasswordField value={value} fieldId={id ?? label} />
              ) : (
                <>
                  <span className="font-mono text-zinc-200 break-all">{value ?? '—'}</span>
                  {copyable && value && <CopyButton value={value} />}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RouterAccessCard({ routerId }: { routerId: string }) {
  const [editing, setEditing] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['router-access', routerId],
    queryFn: () => api.routers.getAccess(routerId),
    select: (r) => unwrap<RouterAccessCredentials>(r),
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton />;

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center">
        <p className="text-sm text-red-400">Impossible de charger les identifiants d&apos;accès.</p>
      </div>
    );
  }

  const webfigProxyUrl = data.webfig.url;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
      {/* Public port-map section */}
      <PublicAccessSection routerId={routerId} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">Accès Distant</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Via tunnel WireGuard · IP VPN : {data.vpnIp}</p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionBadge routerId={routerId} />
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Configurer
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <EditForm routerId={routerId} creds={data} onClose={() => setEditing(false)} />
      )}

      {/* Winbox */}
      <AccessBlock
        icon={<Monitor className="h-4 w-4 text-blue-400" />}
        title="Winbox / App MikroTik"
        accentClass="border-blue-500/20"
        rows={[
          { label: 'Adresse', value: data.winbox.address, copyable: true },
          { label: 'Utilisateur', value: data.winbox.username, copyable: true },
          { label: 'Mot de passe', value: data.winbox.password, secret: true, id: 'winbox-pwd' },
        ]}
        action={
          <a
            href={data.winbox.deepLink}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/25 transition-colors"
          >
            <Monitor className="h-3.5 w-3.5" />
            Ouvrir MikroTik App
          </a>
        }
      />

      {/* WebFig */}
      <AccessBlock
        icon={<Globe className="h-4 w-4 text-violet-400" />}
        title="WebFig (Navigateur)"
        accentClass="border-violet-500/20"
        rows={[
          { label: 'URL', value: data.webfig.url, copyable: true },
          { label: 'Utilisateur', value: data.webfig.username, copyable: true },
          { label: 'Mot de passe', value: data.webfig.password, secret: true, id: 'webfig-pwd' },
        ]}
        action={
          <a
            href={webfigProxyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/25 transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            Accéder WebFig
          </a>
        }
      />

      {/* SSH */}
      <AccessBlock
        icon={<Terminal className="h-4 w-4 text-emerald-400" />}
        title="SSH Terminal"
        accentClass="border-emerald-500/20"
        rows={[
          { label: 'Commande', value: data.ssh.command, copyable: true },
          { label: 'Hôte', value: data.ssh.host },
          { label: 'Port', value: String(data.ssh.port) },
          { label: 'Utilisateur', value: data.ssh.username, copyable: true },
          { label: 'Mot de passe', value: data.ssh.password, secret: true, id: 'ssh-pwd' },
        ]}
      />
    </div>
  );
}
