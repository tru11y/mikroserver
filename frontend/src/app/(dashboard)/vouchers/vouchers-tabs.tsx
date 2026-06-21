'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { AlertTriangle, Boxes, List, Plus, ShieldCheck, type LucideIcon } from 'lucide-react';

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  perm?: 'view' | 'create' | 'verify';
  badgeKey?: keyof VouchersTabBadges;
}

export interface VouchersTabBadges {
  issues?: number;
}

const TABS: Tab[] = [
  { href: '/vouchers/stock',    label: 'Stock',     icon: Boxes,         perm: 'view',   badgeKey: 'issues' },
  { href: '/vouchers',          label: 'Liste',     icon: List,          exact: true,    perm: 'view'   },
  { href: '/vouchers/generate', label: 'Générer',   icon: Plus,          perm: 'create' },
  { href: '/vouchers/verify',   label: 'Vérifier',  icon: ShieldCheck,   perm: 'verify' },
  { href: '/vouchers/orphans',  label: 'Orphelins', icon: AlertTriangle, perm: 'view'   },
];

interface VouchersTabsProps {
  permissions: {
    canView: boolean;
    canCreate: boolean;
    canVerify: boolean;
  };
  badges?: VouchersTabBadges;
}

export function VouchersTabs({ permissions, badges }: VouchersTabsProps) {
  const pathname = usePathname();

  const allowed = TABS.filter((t) => {
    if (t.perm === 'view')   return permissions.canView;
    if (t.perm === 'create') return permissions.canCreate;
    if (t.perm === 'verify') return permissions.canVerify;
    return true;
  });

  return (
    <div className="border-b -mx-3 px-3 md:-mx-6 md:px-6 overflow-x-auto">
      <nav className="flex items-center gap-1" aria-label="Sous-navigation Tickets">
        {allowed.map((tab) => {
          const Icon = tab.icon;
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + '/');
          const badgeCount = tab.badgeKey ? (badges?.[tab.badgeKey] ?? 0) : 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                'relative inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all duration-200 ease-out whitespace-nowrap -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {badgeCount > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground tabular-nums">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
