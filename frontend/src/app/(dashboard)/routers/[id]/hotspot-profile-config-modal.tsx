import type { HotspotProfile } from './router-detail.types';

interface HotspotProfileConfigModalProps {
  profile: HotspotProfile | null;
  isOpen: boolean;
  name: string;
  rateRx: string;
  rateTx: string;
  sharedUsers: string;
  sessionTimeout: string;
  idleTimeout: string;
  keepaliveTimeout: string;
  addressPool: string;
  isPending: boolean;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onRateRxChange: (value: string) => void;
  onRateTxChange: (value: string) => void;
  onSharedUsersChange: (value: string) => void;
  onSessionTimeoutChange: (value: string) => void;
  onIdleTimeoutChange: (value: string) => void;
  onKeepaliveTimeoutChange: (value: string) => void;
  onAddressPoolChange: (value: string) => void;
  onSubmit: () => void;
}

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';

export function HotspotProfileConfigModal({
  profile,
  isOpen,
  name,
  rateRx,
  rateTx,
  sharedUsers,
  sessionTimeout,
  idleTimeout,
  keepaliveTimeout,
  addressPool,
  isPending,
  onClose,
  onNameChange,
  onRateRxChange,
  onRateTxChange,
  onSharedUsersChange,
  onSessionTimeoutChange,
  onIdleTimeoutChange,
  onKeepaliveTimeoutChange,
  onAddressPoolChange,
  onSubmit,
}: HotspotProfileConfigModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl mx-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">
              {profile ? 'Modifier un profil hotspot' : 'Nouveau profil hotspot'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Equivalence Winbox: menu `/ip/hotspot/user/profile`
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border px-2 py-1 text-xs hover:bg-muted"
          >
            Fermer
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nom du profil</label>
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onBlur={(e) => onNameChange(e.target.value.trim())}
              className={inputClass}
              placeholder="Ex: 7-Jours"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Shared-users</label>
            <input
              value={sharedUsers}
              onChange={(e) => onSharedUsersChange(e.target.value)}
              onBlur={(e) => onSharedUsersChange(e.target.value.trim())}
              className={inputClass}
              placeholder="Ex: 1"
            />
          </div>

          {/* RX and TX as separate fields to avoid human error */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Bande passante — Download (RX)
            </label>
            <input
              value={rateRx}
              onChange={(e) => onRateRxChange(e.target.value)}
              onBlur={(e) => onRateRxChange(e.target.value.trim())}
              className={inputClass}
              placeholder="Ex: 2M"
            />
            <p className="text-xs text-muted-foreground">Débit max reçu par le client</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Bande passante — Upload (TX)
            </label>
            <input
              value={rateTx}
              onChange={(e) => onRateTxChange(e.target.value)}
              onBlur={(e) => onRateTxChange(e.target.value.trim())}
              className={inputClass}
              placeholder="Ex: 1M"
            />
            <p className="text-xs text-muted-foreground">Débit max envoyé par le client</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Session-timeout</label>
            <input
              value={sessionTimeout}
              onChange={(e) => onSessionTimeoutChange(e.target.value)}
              onBlur={(e) => onSessionTimeoutChange(e.target.value.trim())}
              className={inputClass}
              placeholder="Ex: 7d 00:00:00"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Idle-timeout</label>
            <input
              value={idleTimeout}
              onChange={(e) => onIdleTimeoutChange(e.target.value)}
              onBlur={(e) => onIdleTimeoutChange(e.target.value.trim())}
              className={inputClass}
              placeholder="Ex: none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Keepalive-timeout</label>
            <input
              value={keepaliveTimeout}
              onChange={(e) => onKeepaliveTimeoutChange(e.target.value)}
              onBlur={(e) => onKeepaliveTimeoutChange(e.target.value.trim())}
              className={inputClass}
              placeholder="Ex: 2m"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Address-pool</label>
            <input
              value={addressPool}
              onChange={(e) => onAddressPoolChange(e.target.value)}
              onBlur={(e) => onAddressPoolChange(e.target.value.trim())}
              className={inputClass}
              placeholder="Ex: hotspot-pool"
            />
          </div>
        </div>

        {(rateRx.trim() || rateTx.trim()) && (
          <p className="text-xs text-muted-foreground">
            Valeur envoyée au routeur :{' '}
            <span className="font-mono text-foreground">
              rate-limit={[rateRx.trim(), rateTx.trim()].filter(Boolean).join('/')}
            </span>
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            Annuler
          </button>
          <button
            onClick={onSubmit}
            disabled={isPending || !name.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? 'Enregistrement...' : profile ? 'Mettre a jour' : 'Creer'}
          </button>
        </div>
      </div>
    </div>
  );
}
