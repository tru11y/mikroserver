import { clsx } from 'clsx';
import { Pencil, Plus, Power, PowerOff } from 'lucide-react';
import type { HotspotIpBinding } from './router-detail.types';
import { normalizeIpBindingType } from './router-detail.utils';

interface HotspotIpBindingsSectionProps {
  canManageHotspot: boolean;
  errorMessage: string | null;
  isLoading: boolean;
  bindings: HotspotIpBinding[];
  routerHotspotServer?: string | null;
  ipBindingActionId: string | null;
  isToggleBlockPending: boolean;
  isToggleEnabledPending: boolean;
  isRemovePending: boolean;
  onOpenCreate: () => void;
  onEdit: (binding: HotspotIpBinding) => void;
  onToggleBlock: (binding: HotspotIpBinding) => void;
  onToggleEnabled: (binding: HotspotIpBinding) => void;
  onRemove: (binding: HotspotIpBinding) => void;
}

export function HotspotIpBindingsSection({
  canManageHotspot,
  errorMessage,
  isLoading,
  bindings,
  routerHotspotServer,
  ipBindingActionId,
  isToggleBlockPending,
  isToggleEnabledPending,
  isRemovePending,
  onOpenCreate,
  onEdit,
  onToggleBlock,
  onToggleEnabled,
  onRemove,
}: HotspotIpBindingsSectionProps) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">IP Bindings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Regles /ip/hotspot/ip-binding du routeur
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{bindings.length} entree(s)</span>
          {canManageHotspot && (
            <button
              onClick={onOpenCreate}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
            >
              <Plus className="h-3 w-3" />
              Ajouter
            </button>
          )}
        </div>
      </div>

      {!canManageHotspot && (
        <p className="mt-3 text-xs text-amber-300">
          Mode lecture seule: permission `routers.hotspot_manage` requise pour modifier/bloquer.
        </p>
      )}

      {errorMessage && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Impossible de charger les IP bindings: {errorMessage}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground mt-4">Chargement des IP bindings...</p>
      ) : bindings.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-4">
          Aucun IP binding configure sur ce routeur.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Adresse
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  MAC
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Utilisateur / Host
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Type
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Serveur
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  To-Address
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Address-List
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Commentaire
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Statut
                </th>
                {canManageHotspot && (
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bindings.map((binding) => {
                const bindingType = normalizeIpBindingType(binding.type);

                return (
                  <tr key={binding.id}>
                    <td className="px-3 py-2 font-mono text-xs">{binding.address ?? '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{binding.macAddress ?? '-'}</td>
                    <td className="px-3 py-2 text-xs">
                      <p>{binding.resolvedUser ?? '-'}</p>
                      <p className="text-muted-foreground">{binding.hostName ?? '-'}</p>
                    </td>
                    <td className="px-3 py-2 text-xs">{bindingType}</td>
                    <td className="px-3 py-2 text-xs">
                      {binding.server ?? routerHotspotServer ?? '-'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{binding.toAddress ?? '-'}</td>
                    <td className="px-3 py-2 text-xs">{binding.addressList ?? '-'}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className="line-clamp-2">{binding.comment ?? '-'}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={clsx(
                          'rounded-full border px-2 py-0.5',
                          binding.disabled
                            ? 'border-red-400/30 text-red-300'
                            : 'border-emerald-400/30 text-emerald-300',
                        )}
                      >
                        {binding.disabled ? 'Desactive' : 'Actif'}
                      </span>
                    </td>
                    {canManageHotspot && (
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <button
                            onClick={() => onEdit(binding)}
                            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            Modifier
                          </button>
                          <button
                            onClick={() => onToggleBlock(binding)}
                            disabled={isToggleBlockPending}
                            className={clsx(
                              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50',
                              bindingType === 'blocked'
                                ? 'text-emerald-300 hover:bg-emerald-500/10'
                                : 'text-red-300 hover:bg-red-500/10',
                            )}
                          >
                            {ipBindingActionId === binding.id
                              ? '...'
                              : bindingType === 'blocked'
                                ? 'Debloquer'
                                : 'Bloquer'}
                          </button>
                          <button
                            onClick={() => onToggleEnabled(binding)}
                            disabled={isToggleEnabledPending}
                            className={clsx(
                              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50',
                              binding.disabled
                                ? 'text-emerald-300 hover:bg-emerald-500/10'
                                : 'text-amber-300 hover:bg-amber-500/10',
                            )}
                          >
                            {ipBindingActionId === binding.id ? (
                              '...'
                            ) : binding.disabled ? (
                              <>
                                <Power className="h-3 w-3" />
                                Activer
                              </>
                            ) : (
                              <>
                                <PowerOff className="h-3 w-3" />
                                Desactiver
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => onRemove(binding)}
                            disabled={isRemovePending}
                            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {ipBindingActionId === binding.id ? '...' : 'Supprimer'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
