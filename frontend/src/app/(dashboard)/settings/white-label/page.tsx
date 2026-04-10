'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface WhiteLabelConfig {
  platformName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  supportEmail: string | null;
  supportPhone: string | null;
  footerText: string | null;
  customCss: string | null;
}

export default function WhiteLabelPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['white-label-config'],
    queryFn: () => apiClient.get<WhiteLabelConfig>('/white-label/config').then(r => r.data),
  });
  const [form, setForm] = useState<Partial<WhiteLabelConfig>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (data: Partial<WhiteLabelConfig>) =>
      apiClient.patch<WhiteLabelConfig>('/white-label/config', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['white-label-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const set = (key: keyof WhiteLabelConfig, value: string | null) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (isLoading)
    return <div className="p-6 text-muted-foreground">Chargement...</div>;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Personnalisation (White-label)</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Personnalisez l&apos;apparence de votre plateforme et du portail WiFi
          client.
        </p>
      </div>

      {/* Identité */}
      <div className="space-y-4 border rounded-lg p-4 bg-card">
        <h2 className="font-semibold">Identité</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium">Nom de la plateforme</label>
          <input
            className="w-full border rounded px-3 py-2 bg-background text-sm"
            value={form.platformName ?? ''}
            onChange={(e) => set('platformName', e.target.value)}
            placeholder="MikroServer"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">URL du logo</label>
          <input
            className="w-full border rounded px-3 py-2 bg-background text-sm"
            value={form.logoUrl ?? ''}
            onChange={(e) => set('logoUrl', e.target.value || null)}
            placeholder="https://..."
          />
          {form.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.logoUrl}
              alt="Logo preview"
              className="mt-2 h-12 object-contain"
            />
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">URL du favicon</label>
          <input
            className="w-full border rounded px-3 py-2 bg-background text-sm"
            value={form.faviconUrl ?? ''}
            onChange={(e) => set('faviconUrl', e.target.value || null)}
            placeholder="https://..."
          />
        </div>
      </div>

      {/* Couleurs */}
      <div className="space-y-4 border rounded-lg p-4 bg-card">
        <h2 className="font-semibold">Couleurs</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Couleur principale</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                className="h-9 w-12 rounded border cursor-pointer"
                value={form.primaryColor ?? '#6366f1'}
                onChange={(e) => set('primaryColor', e.target.value)}
              />
              <input
                className="flex-1 border rounded px-3 py-2 bg-background text-sm font-mono"
                value={form.primaryColor ?? '#6366f1'}
                onChange={(e) => set('primaryColor', e.target.value)}
                placeholder="#6366f1"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Couleur d&apos;accent
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                className="h-9 w-12 rounded border cursor-pointer"
                value={form.accentColor ?? '#8b5cf6'}
                onChange={(e) => set('accentColor', e.target.value)}
              />
              <input
                className="flex-1 border rounded px-3 py-2 bg-background text-sm font-mono"
                value={form.accentColor ?? '#8b5cf6'}
                onChange={(e) => set('accentColor', e.target.value)}
                placeholder="#8b5cf6"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Support & Contact */}
      <div className="space-y-4 border rounded-lg p-4 bg-card">
        <h2 className="font-semibold">Support &amp; Contact</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email support</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2 bg-background text-sm"
              value={form.supportEmail ?? ''}
              onChange={(e) => set('supportEmail', e.target.value || null)}
              placeholder="support@..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Téléphone support</label>
            <input
              className="w-full border rounded px-3 py-2 bg-background text-sm"
              value={form.supportPhone ?? ''}
              onChange={(e) => set('supportPhone', e.target.value || null)}
              placeholder="+225..."
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Texte de pied de page</label>
          <textarea
            className="w-full border rounded px-3 py-2 bg-background text-sm"
            rows={2}
            value={form.footerText ?? ''}
            onChange={(e) => set('footerText', e.target.value || null)}
            placeholder="© 2026 Mon WiFi — Tous droits réservés"
          />
        </div>
      </div>

      {/* CSS personnalisé */}
      <div className="space-y-4 border rounded-lg p-4 bg-card">
        <h2 className="font-semibold">CSS personnalisé</h2>
        <p className="text-xs text-muted-foreground">
          Maximum 5000 caractères. S&apos;applique au portail WiFi client.
        </p>
        <textarea
          className="w-full border rounded px-3 py-2 bg-background text-sm font-mono"
          rows={6}
          value={form.customCss ?? ''}
          onChange={(e) => set('customCss', e.target.value || null)}
          placeholder=":root { --brand: #6366f1; }"
        />
        <p className="text-xs text-muted-foreground text-right">
          {(form.customCss ?? '').length}/5000
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {saved && (
          <span className="text-sm text-green-600">Sauvegardé !</span>
        )}
        {mutation.isError && (
          <span className="text-sm text-destructive">
            Erreur lors de la sauvegarde.
          </span>
        )}
      </div>
    </div>
  );
}
