import { buildSelectableHotspotProfileNames } from './router-detail.selectors';
import type { HotspotUserRow } from './router-detail.types';

interface HotspotProfileChangeModalProps {
  user: HotspotUserRow | null;
  availableProfileNames: string[];
  isUsingFallbackProfiles?: boolean;
  nextProfile: string;
  disconnectActive: boolean;
  isPending: boolean;
  onClose: () => void;
  onNextProfileChange: (value: string) => void;
  onDisconnectActiveChange: (value: boolean) => void;
  onSubmit: () => void;
}

export function HotspotProfileChangeModal({
  user,
  availableProfileNames,
  isUsingFallbackProfiles = false,
  nextProfile,
  disconnectActive,
  isPending,
  onClose,
  onNextProfileChange,
  onDisconnectActiveChange,
  onSubmit,
}: HotspotProfileChangeModalProps) {
  if (!user) {
    return null;
  }

  const selectableProfileNames = buildSelectableHotspotProfileNames(
    availableProfileNames,
    user.profile,
  );

  const isSameProfile =
    (user.profile ?? '').trim().toLowerCase() === nextProfile.trim().toLowerCase();
  const canSubmit =
    selectableProfileNames.length > 0 &&
    nextProfile.trim().length > 0 &&
    !isSameProfile;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl mx-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Changer le profil hotspot</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Utilisateur: <span className="font-mono">{user.username}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border px-2 py-1 text-xs hover:bg-muted"
          >
            Fermer
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nouveau profil</label>
          <select
            value={nextProfile}
            onChange={(event) => onNextProfileChange(event.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={selectableProfileNames.length === 0}
          >
            {selectableProfileNames.length === 0 ? (
              <option value="">Aucun profil charge</option>
            ) : (
              selectableProfileNames.map((profileName) => (
                <option key={profileName} value={profileName}>
                  {profileName}
                </option>
              ))
            )}
          </select>
          <p className="text-xs text-muted-foreground">
            Profil actuel: {user.profile ?? 'aucun'}
          </p>
          {selectableProfileNames.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectableProfileNames.length} profil(s) selectionnable(s)
            </p>
          )}
          {selectableProfileNames.length === 0 && (
            <p className="text-xs text-amber-300">
              Aucun profil RouterOS n est charge. Recharge d abord les profils du routeur avant de changer ce profil.
            </p>
          )}
          {selectableProfileNames.length > 0 && isUsingFallbackProfiles && (
            <p className="text-xs text-amber-300">
              Liste detaillee des profils Winbox indisponible pour le moment. Selection basee sur les profils detectes via utilisateurs, forfaits et configuration routeur.
            </p>
          )}
          {isSameProfile && nextProfile.trim().length > 0 && (
            <p className="text-xs text-amber-300">
              Le profil selectionne est identique au profil actuel. Choisis un autre profil pour appliquer un changement.
            </p>
          )}
        </div>

        <label className="flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-3 text-sm">
          <input
            type="checkbox"
            checked={disconnectActive}
            onChange={(event) => onDisconnectActiveChange(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            Couper les sessions actives apres changement pour appliquer le nouveau profil
            immédiatement.
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
            disabled={isPending || !canSubmit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? 'Mise a jour...' : 'Mettre a jour'}
          </button>
        </div>
      </div>
    </div>
  );
}
