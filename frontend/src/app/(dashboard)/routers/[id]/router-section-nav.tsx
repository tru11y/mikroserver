'use client';

import { clsx } from 'clsx';
import { ArrowRightLeft, History, Layers3, Link2, Radio, TerminalSquare, Users2 } from 'lucide-react';
import type { RouterDetailSection } from './router-detail.types';

interface RouterSectionNavProps {
  activeSection: RouterDetailSection;
  onSectionChange: (section: RouterDetailSection) => void;
  statsActiveClients?: number;
  profilesCount: number;
  bindingsCount: number;
  usersCount: number;
  isLiveUnavailable?: boolean;
  isProfilesUnavailable?: boolean;
  isBindingsUnavailable?: boolean;
  isUsersUnavailable?: boolean;
}

const SECTION_ITEMS: Array<{
  id: RouterDetailSection;
  label: string;
  icon: typeof Radio;
}> = [
  { id: 'live', label: 'Clients connectés', icon: Radio },
  { id: 'users', label: 'Utilisateurs hotspot', icon: Users2 },
  { id: 'profiles', label: 'Profils', icon: Layers3 },
  { id: 'bindings', label: 'IP bindings', icon: Link2 },
  { id: 'migration', label: 'Migration', icon: ArrowRightLeft },
  { id: 'history', label: 'Historique', icon: History },
  { id: 'terminal', label: 'Terminal SSH', icon: TerminalSquare },
];

function getSectionCount(
  section: RouterDetailSection,
  {
    statsActiveClients,
    profilesCount,
    bindingsCount,
    usersCount,
  }: Pick<
    RouterSectionNavProps,
    'statsActiveClients' | 'profilesCount' | 'bindingsCount' | 'usersCount'
  >,
) {
  switch (section) {
    case 'live':
      return statsActiveClients ?? 0;
    case 'profiles':
      return profilesCount;
    case 'bindings':
      return bindingsCount;
    case 'users':
      return usersCount;
    case 'migration':
    case 'history':
      return 0;
  }
}

export function RouterSectionNav({
  activeSection,
  onSectionChange,
  statsActiveClients,
  profilesCount,
  bindingsCount,
  usersCount,
  isLiveUnavailable = false,
  isProfilesUnavailable = false,
  isBindingsUnavailable = false,
  isUsersUnavailable = false,
}: RouterSectionNavProps) {
  return (
    <div className="sticky top-3 z-10 rounded-2xl border bg-background/90 p-2 backdrop-blur">
      <div className="flex flex-wrap gap-2">
        {SECTION_ITEMS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          const count = getSectionCount(section.id, {
            statsActiveClients,
            profilesCount,
            bindingsCount,
            usersCount,
          });
          const isUnavailable =
            (section.id === 'live' && isLiveUnavailable) ||
            (section.id === 'profiles' && isProfilesUnavailable) ||
            (section.id === 'bindings' && isBindingsUnavailable) ||
            (section.id === 'users' && isUsersUnavailable);

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              className={clsx(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all',
                isActive
                  ? 'border-primary/40 bg-primary/10 text-foreground shadow-sm'
                  : 'border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{section.label}</span>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-xs tabular-nums',
                  isUnavailable && 'border border-amber-400/30 bg-amber-400/10 text-amber-200',
                  isActive
                    ? 'bg-primary/20 text-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {isUnavailable && count === 0 ? '!' : count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
