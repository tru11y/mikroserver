'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { RouterDetail, RouterMigrationResult } from './router-detail.types';

interface RouterMigrationSectionProps {
  routerId: string;
  routerName: string;
  canManage: boolean;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function RouterMigrationSection({
  routerId,
  routerName,
  canManage,
}: RouterMigrationSectionProps) {
  const [targetRouterId, setTargetRouterId] = useState('');
  const [preview, setPreview] = useState<RouterMigrationResult | null>(null);
  const [result, setResult] = useState<RouterMigrationResult | null>(null);

  const { data: routersData } = useQuery({
    queryKey: ['routers', 'list'],
    queryFn: () => api.routers.list(),
    staleTime: 60_000,
  });

  const otherRouters: RouterDetail[] = (
    (routersData?.data?.data as { items?: RouterDetail[] })?.items ?? []
  ).filter((r) => r.id !== routerId);

  const previewMutation = useMutation({
    mutationFn: () => api.routers.migrateToRouter(routerId, targetRouterId, true),
    onSuccess: (res) => {
      setPreview((res.data?.data as RouterMigrationResult) ?? null);
      setResult(null);
    },
  });

  const migrateMutation = useMutation({
    mutationFn: () => api.routers.migrateToRouter(routerId, targetRouterId, false),
    onSuccess: (res) => {
      const r = res.data?.data as RouterMigrationResult;
      setResult(r);
      setPreview(null);
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4">
          <h2 className="font-semibold">Migration des tickets actifs</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Transfère tous les tickets actifs (avec leur temps restant) de <strong>{routerName}</strong> vers un autre routeur.
            Les tickets sont recréés à l&apos;identique et les anciens sont expirés.
          </p>
        </div>

        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-300 flex gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Action irréversible. Les clients déjà connectés sur l&apos;ancien routeur seront déconnectés au prochain sync.
            Effectuez d&apos;abord une prévisualisation (<strong>Simuler</strong>) avant de confirmer.
          </span>
        </div>

        {!canManage ? (
          <p className="text-sm text-muted-foreground">Droits insuffisants pour effectuer une migration.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Routeur cible
              </label>
              <select
                value={targetRouterId}
                onChange={(e) => {
                  setTargetRouterId(e.target.value);
                  setPreview(null);
                  setResult(null);
                }}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="">— Sélectionner un routeur —</option>
                {otherRouters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.wireguardIp ?? '—'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => previewMutation.mutate()}
                disabled={!targetRouterId || previewMutation.isPending || migrateMutation.isPending}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
              >
                {previewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                Simuler
              </button>

              {preview && preview.count > 0 && !result && (
                <button
                  onClick={() => migrateMutation.mutate()}
                  disabled={migrateMutation.isPending}
                  className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-300 transition-colors hover:bg-amber-400/20 disabled:opacity-50"
                >
                  {migrateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="h-4 w-4" />
                  )}
                  Confirmer la migration ({preview.count} tickets)
                </button>
              )}
            </div>

            {previewMutation.isError && (
              <p className="text-xs text-destructive">
                Erreur: {(previewMutation.error as Error)?.message ?? 'Requête échouée'}
              </p>
            )}
            {migrateMutation.isError && (
              <p className="text-xs text-destructive">
                Erreur: {(migrateMutation.error as Error)?.message ?? 'Migration échouée'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Preview panel */}
      {preview && !result && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h3 className="font-medium text-sm">
              Prévisualisation — {preview.count} ticket(s) à migrer
            </h3>
            <span className="text-xs text-muted-foreground">Mode simulation (aucune modification)</span>
          </div>
          {preview.count === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Aucun ticket actif à migrer sur ce routeur.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Code</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Temps restant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.migrations.map((m) => (
                    <tr key={m.code} className="hover:bg-muted/20">
                      <td className="px-5 py-3 font-mono text-xs">{m.code}</td>
                      <td className="px-5 py-3 text-xs">{formatMinutes(m.remainingMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Result panel */}
      {result && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h3 className="font-medium text-sm">
              Migration terminée — {result.count} ticket(s) transférés
              {result.failed && result.failed.length > 0 && (
                <span className="ml-2 text-amber-300">({result.failed.length} échec(s))</span>
              )}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Code</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Temps migré</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.migrations.map((m) => (
                  <tr key={m.code} className="hover:bg-muted/20">
                    <td className="px-5 py-3 font-mono text-xs">{m.code}</td>
                    <td className="px-5 py-3 text-xs">{formatMinutes(m.remainingMinutes)}</td>
                    <td className="px-5 py-3 text-xs text-emerald-400">Migré</td>
                  </tr>
                ))}
                {result.failed?.map((code) => (
                  <tr key={code} className="hover:bg-muted/20">
                    <td className="px-5 py-3 font-mono text-xs">{code}</td>
                    <td className="px-5 py-3 text-xs">—</td>
                    <td className="px-5 py-3 text-xs text-destructive">Échec</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
