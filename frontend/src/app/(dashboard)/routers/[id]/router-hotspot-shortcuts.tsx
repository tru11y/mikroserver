'use client';

import { clsx } from 'clsx';
import { Layers3, Link2, Radio, Users2 } from 'lucide-react';
import type { RouterDetailSection } from './router-detail.types';

interface RouterHotspotShortcutsProps {
  activeSection: RouterDetailSection;
  onSectionChange: (section: RouterDetailSection) => void;
  activeClients: number;
  usersCount: number;
  profilesCount: number;
  bindingsCount: number;
  isLiveUnavailable?: boolean;
  isProfilesUnavailable?: boolean;
  isBindingsUnavailable?: boolean;
  isUsersUnavailable?: boolean;
}

const items: Array<{
  id: RouterDetailSection;
  title: string;
  description: string;
  icon: typeof Radio;
}> = [
  {
    id: 'users',
    title: 'Changer un profil',
    description:
      'Recherche un utilisateur actif ou inactif puis change son profil sans parcourir toute la page.',
    icon: Users2,
  },
  {
    id: 'live',
    title: 'Agir sur les connectés',
    description:
      'Coupe une session active ou change rapidement le profil d un client actuellement connecté.',
    icon: Radio,
  },
  {
    id: 'profiles',
    title: 'Gérer les profils',
    description:
      'Crée, modifie ou vérifie les profils RouterOS et leur correspondance avec les forfaits SaaS.',
    icon: Layers3,
  },
  {
    id: 'bindings',
    title: 'Gérer les IP bindings',
    description:
      'Bloque, bypass, active ou corrige les bindings réseau du hotspot.',
    icon: Link2,
  },
];

function countFor(
  section: RouterDetailSection,
  counts: Pick<
    RouterHotspotShortcutsProps,
    'activeClients' | 'usersCount' | 'profilesCount' | 'bindingsCount'
  >,
) {
  switch (section) {
    case 'live':
      return counts.activeClients;
    case 'users':
      return counts.usersCount;
    case 'profiles':
      return counts.profilesCount;
    case 'bindings':
      return counts.bindingsCount;
  }
}

export function RouterHotspotShortcuts({
  activeSection,
  onSectionChange,
  activeClients,
  usersCount,
  profilesCount,
  bindingsCount,
  isLiveUnavailable = false,
  isProfilesUnavailable = false,
  isBindingsUnavailable = false,
  isUsersUnavailable = false,
}: RouterHotspotShortcutsProps) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-4">
        <h2 className="font-semibold">Accès rapide hotspot</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          La gestion de profil, des profils RouterOS et des IP bindings reste
          accessible ici en permanence.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeSection;
          const count = countFor(item.id, {
            activeClients,
            usersCount,
            profilesCount,
            bindingsCount,
          });
          const isUnavailable =
            (item.id === 'live' && isLiveUnavailable) ||
            (item.id === 'profiles' && isProfilesUnavailable) ||
            (item.id === 'bindings' && isBindingsUnavailable) ||
            (item.id === 'users' && isUsersUnavailable);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={clsx(
                'rounded-xl border p-4 text-left transition-all',
                active
                  ? 'border-primary/40 bg-primary/10 shadow-sm'
                  : 'border-border/60 bg-background hover:bg-muted/50',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span
                  className={clsx(
                    'rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground',
                    isUnavailable &&
                      'border border-amber-400/30 bg-amber-400/10 text-amber-200',
                  )}
                >
                  {isUnavailable && count === 0 ? '!' : count}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
