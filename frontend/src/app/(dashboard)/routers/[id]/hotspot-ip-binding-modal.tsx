'use client';

import { useEffect, useState } from 'react';
import type { HotspotIpBinding, IpBindingType } from './router-detail.types';

interface HotspotIpBindingModalProps {
  mode: 'create' | 'edit';
  isOpen: boolean;
  binding: HotspotIpBinding | null;
  server: string;
  address: string;
  macAddress: string;
  type: IpBindingType;
  comment: string;
  toAddress: string;
  addressList: string;
  disabled: boolean;
  isPending: boolean;
  onClose: () => void;
  onServerChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onMacAddressChange: (value: string) => void;
  onTypeChange: (value: IpBindingType) => void;
  onCommentChange: (value: string) => void;
  onToAddressChange: (value: string) => void;
  onAddressListChange: (value: string) => void;
  onDisabledChange: (value: boolean) => void;
  onSubmit: () => void;
}

export function HotspotIpBindingModal({
  mode,
  isOpen,
  binding,
  server,
  address,
  macAddress,
  type,
  comment,
  toAddress,
  addressList,
  disabled,
  isPending,
  onClose,
  onServerChange,
  onAddressChange,
  onMacAddressChange,
  onTypeChange,
  onCommentChange,
  onToAddressChange,
  onAddressListChange,
  onDisabledChange,
  onSubmit,
}: HotspotIpBindingModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowAdvanced(false);
      return;
    }

    setShowAdvanced(
      Boolean(comment.trim() || toAddress.trim() || addressList.trim()),
    );
  }, [addressList, comment, isOpen, toAddress]);

  if (!isOpen) {
    return null;
  }

  const isEdit = mode === 'edit';
  const hasPrimaryIdentity = address.trim().length > 0 || macAddress.trim().length > 0;
  const typeHelp =
    type === 'blocked'
      ? 'Bloque cet appareil ou cette IP au niveau hotspot.'
      : type === 'bypassed'
        ? 'Bypasse l authentification hotspot pour cet appareil.'
        : 'Traite cet appareil avec le comportement hotspot normal.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl mx-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">
              {isEdit ? 'Modifier un IP binding' : 'Ajouter un IP binding'}
            </h3>
            {isEdit ? (
              <>
                <p className="text-sm text-muted-foreground mt-1">
                  {binding?.address ?? '-'} / {binding?.macAddress ?? '-'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Utilisateur: {binding?.resolvedUser ?? '-'} | Host: {binding?.hostName ?? '-'}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                Equivalence Winbox: menu `/ip/hotspot/ip-binding`
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border px-2 py-1 text-xs hover:bg-muted"
          >
            Fermer
          </button>
        </div>

        <div className="rounded-xl border bg-muted/20 px-4 py-3">
          <p className="text-sm font-medium">Effet actuel</p>
          <p className="mt-1 text-xs text-muted-foreground">{typeHelp}</p>
          {!hasPrimaryIdentity && (
            <p className="mt-2 text-xs text-amber-300">
              Renseigne au moins une adresse IP ou une adresse MAC pour identifier la cible.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Serveur</label>
            <input
              value={server}
              onChange={(event) => onServerChange(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: hotspot1"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                {
                  value: 'regular' as const,
                  label: 'Normal',
                  description: 'Comportement hotspot standard',
                },
                {
                  value: 'blocked' as const,
                  label: 'Bloqué',
                  description: 'Refuse l acces',
                },
                {
                  value: 'bypassed' as const,
                  label: 'Bypass',
                  description: 'Passe sans auth hotspot',
                },
              ].map((option) => {
                const selected = type === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onTypeChange(option.value)}
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      selected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background hover:bg-muted'
                    }`}
                  >
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Adresse IP</label>
            <input
              value={address}
              onChange={(event) => onAddressChange(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: 10.0.0.120"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Adresse MAC</label>
            <input
              value={macAddress}
              onChange={(event) => onMacAddressChange(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: AA:BB:CC:DD:EE:FF"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-muted/10">
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span>
              <span className="text-sm font-medium">Parametres avances</span>
              <p className="mt-1 text-xs text-muted-foreground">
                Commentaire, redirection IP et address-list Winbox.
              </p>
            </span>
            <span className="text-xs text-muted-foreground">
              {showAdvanced ? 'Masquer' : 'Afficher'}
            </span>
          </button>

          {showAdvanced && (
            <div className="grid gap-3 border-t px-4 py-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Redirection IP (to-address)</label>
                <input
                  value={toAddress}
                  onChange={(event) => onToAddressChange(event.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: 10.0.0.10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Liste d adresses</label>
                <input
                  value={addressList}
                  onChange={(event) => onAddressListChange(event.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: whitelist"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Commentaire</label>
                <input
                  value={comment}
                  onChange={(event) => onCommentChange(event.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Commentaire visible dans Winbox"
                />
              </div>
            </div>
          )}
        </div>

        <label className="flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-3 text-sm">
          <input
            type="checkbox"
            checked={disabled}
            onChange={(event) => onDisabledChange(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            {isEdit ? 'Desactiver cette regle IP binding' : 'Creer cette regle en etat desactive'}
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            Annuler
          </button>
          <button
            onClick={onSubmit}
            disabled={isPending || !hasPrimaryIdentity}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending
              ? isEdit
                ? 'Mise a jour...'
                : 'Creation...'
              : isEdit
                ? 'Mettre a jour'
                : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
