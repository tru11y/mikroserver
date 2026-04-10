'use client';

import type { FormEvent, Dispatch, SetStateAction } from 'react';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, UserCog, Scan } from 'lucide-react';
import { unwrap } from '@/lib/api';
import { usersApi } from '@/lib/api/users';
import type { RouterFormState } from './routers.types';

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface RouterFormPanelProps {
  open: boolean;
  editingName?: string | null;
  formState: RouterFormState;
  setFormState: Dispatch<SetStateAction<RouterFormState>>;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSuperAdmin?: boolean;
}

async function detectGatewayIp(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      const ips: string[] = [];

      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          pc.close();
          const local = ips.find(
            (ip) =>
              ip.startsWith('192.168.') ||
              (ip.startsWith('10.') && !ip.startsWith('10.66.66.')) ||
              ip.startsWith('172.'),
          );
          if (local) {
            const parts = local.split('.');
            parts[3] = '1';
            resolve(parts.join('.'));
          } else {
            resolve(null);
          }
          return;
        }
        const match = /(\d+\.\d+\.\d+\.\d+)/.exec(e.candidate.candidate);
        if (match) ips.push(match[1]);
      };

      pc.createOffer().then((o) => pc.setLocalDescription(o));
      setTimeout(() => { pc.close(); resolve(null); }, 3000);
    } catch {
      resolve(null);
    }
  });
}

export function RouterFormPanel({
  open,
  editingName,
  formState,
  setFormState,
  isPending,
  onClose,
  onSubmit,
  isSuperAdmin = false,
}: RouterFormPanelProps) {
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  const { data: admins = [] } = useQuery<AdminUser[]>({
    queryKey: ['users', 'admins'],
    queryFn: async () => {
      const res = await usersApi.list('ADMIN');
      return unwrap<AdminUser[]>(res);
    },
    enabled: isSuperAdmin && open,
    staleTime: 5 * 60 * 1000,
  });

  const handleDetect = useCallback(async () => {
    setDetecting(true);
    setDetectError(null);
    const ip = await detectGatewayIp();
    setDetecting(false);
    if (ip) {
      setFormState((s) => ({ ...s, wireguardIp: ip }));
    } else {
      setDetectError('Impossible de détecter automatiquement. Entrez l\'IP manuellement.');
    }
  }, [setFormState]);

  if (!open) {
    return null;
  }

  return (
    <section
      id="composer"
      className="rounded-[28px] border bg-[linear-gradient(180deg,rgba(56,189,248,0.08),rgba(255,255,255,0.02))] p-6 shadow-[0_22px_60px_-40px_rgba(14,165,233,0.5)]"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {editingName ? `Modifier ${editingName}` : 'Ajouter un routeur'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Entrez les identifiants de votre routeur MikroTik pour le connecter a la plateforme.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-4 py-2 text-sm transition-colors hover:bg-white/5"
          >
            Fermer
          </button>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-background/40 p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Commentaire *</span>
              <input
                value={formState.name}
                onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                placeholder="Cybercafé Centre-Ville"
                required
                className="w-full rounded-2xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Adresse IP *</span>
                <button
                  type="button"
                  onClick={handleDetect}
                  disabled={detecting}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-sky-300 transition-colors hover:bg-sky-400/10 disabled:opacity-50"
                  title="Détecter automatiquement le gateway du hotspot connecté"
                >
                  {detecting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Scan className="h-3 w-3" />
                  )}
                  {detecting ? 'Détection...' : 'Détecter'}
                </button>
              </div>
              <input
                value={formState.wireguardIp}
                onChange={(e) => setFormState((s) => ({ ...s, wireguardIp: e.target.value }))}
                placeholder="192.168.88.1"
                required
                className="w-full rounded-2xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {detectError && (
                <p className="text-xs text-amber-400">{detectError}</p>
              )}
            </div>

            <label className="space-y-1.5">
              <span className="text-sm font-medium">Utilisateur admin *</span>
              <input
                value={formState.apiUsername}
                onChange={(e) => setFormState((s) => ({ ...s, apiUsername: e.target.value }))}
                placeholder="admin"
                required
                className="w-full rounded-2xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium">
                Mot de passe admin {editingName ? '' : '*'}
              </span>
              <input
                type="password"
                value={formState.apiPassword}
                onChange={(e) => setFormState((s) => ({ ...s, apiPassword: e.target.value }))}
                placeholder={editingName ? 'Laisser vide pour conserver' : ''}
                required={!editingName}
                className="w-full rounded-2xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>

          {isSuperAdmin && (
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <UserCog className="h-4 w-4 text-violet-300" />
                <span className="text-sm font-medium">Propriétaire</span>
              </div>
              <select
                value={formState.ownerId}
                onChange={(e) => setFormState((s) => ({ ...s, ownerId: e.target.value }))}
                className="w-full rounded-2xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— Aucun propriétaire —</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.firstName} {admin.lastName} ({admin.email})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-4 py-2 text-sm transition-colors hover:bg-white/5"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editingName ? 'Enregistrer' : 'Ajouter le routeur'}
          </button>
        </div>
      </form>
    </section>
  );
}
