'use client';

import { clsx } from 'clsx';
import {
  ArrowRightLeft,
  History,
  Layers3,
  Link2,
  MonitorSmartphone,
  Radio,
  ShieldCheck,
  TerminalSquare,
  Users2,
} from 'lucide-react';
import type { RouterDetailSection } from './router-detail.types';

interface RouterSectionNavProps {
  activeSection: RouterDetailSection;
  onSectionChange: (section: RouterDetailSection) => void;
  statsActiveClients?: number;
  profilesCount: number;
  bindingsCount: number;
  usersCount: number;
  complianceCriticals: number;
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
  { id: 'conformite', label: 'Conformité', icon: ShieldCheck },
  { id: 'profiles', label: 'Profils', icon: Layers3 },
  { id: 'bindings', label: 'IP bindings', icon: Link2 },
  { id: 'migration', label: 'Migration', icon: ArrowRightLeft },
  { id: 'history', label: 'Historique', icon: History },
  { id: 'terminal', label: 'Terminal SSH', icon: TerminalSquare },
  { id: 'access', label: 'Accès Distant', icon: MonitorSmartphone },
];

function getSectionCount(
  section: RouterDetailSection,
  counts: Pick<
    RouterSectionNavProps,
    'statsActiveClients' | 'profilesCount' | 'bindingsCount' | 'usersCount' | 'complianceCriticals'
  >,
) {
  switch (section) {
    case 'live':
      return counts.statsActiveClients ?? 0;
    case 'profiles':
      return counts.profilesCount;
    case 'bindings':
      return counts.bindingsCount;
    case 'users':
      return counts.usersCount;
    case 'conformite':
      return counts.complianceCriticals;
    default:
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
  complianceCriticals,
  isLiveUnavailable = false,
  isProfilesUnavailable = false,
  isBindingsUnavailable = false,
  isUsersUnavailable = false,
}: RouterSectionNavProps) {
  return (
    <nav
      aria-label="Sections du routeur"
      className="sticky top-3 z-10 rounded-2xl border bg-background/90 p-2 backdrop-blur"
    >
      <div
        role="tablist"
        aria-label="Navigation sections routeur"
        className="flex overflow-x-auto gap-2 pb-0.5 scrollbar-thin"
      >
        {SECTION_ITEMS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          const count = getSectionCount(section.id, {
            statsActiveClients,
            profilesCount,
            bindingsCount,
            usersCount,
            complianceCriticals,
          });
          const isUnavailable =
            (section.id === 'live' && isLiveUnavailable) ||
            (section.id === 'profiles' && isProfilesUnavailable) ||
            (section.id === 'bindings' && isBindingsUnavailable) ||
            (section.id === 'users' && isUsersUnavailable);
          const isComplianceAlert =
            section.id === 'conformite' && complianceCriticals > 0;

          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              onClick={() => onSectionChange(section.id)}
              className={clsx(
                'flex flex-shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? 'border-primary/40 bg-primary/10 text-foreground shadow-sm'
                  : 'border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="font-medium">{section.label}</span>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-xs tabular-nums',
                  isUnavailable && 'border border-warning/30 bg-warning/10 text-warning',
                  isComplianceAlert && 'border border-destructive/30 bg-destructive/10 text-destructive',
                  section.id === 'conformite' && !isComplianceAlert && 'border border-success/30 bg-success/10 text-success',
                  !isUnavailable && !isComplianceAlert && section.id !== 'conformite' && isActive && 'bg-primary/20 text-foreground',
                  !isUnavailable && !isComplianceAlert && section.id !== 'conformite' && !isActive && 'bg-muted text-muted-foreground',
                )}
              >
                {isUnavailable && count === 0
                  ? '!'
                  : section.id === 'conformite' && count === 0
                    ? '✓'
                    : count}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
