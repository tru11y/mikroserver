'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import {
  LayoutDashboard, Wifi, CreditCard, Ticket,
  BarChart3, Settings, Activity, Users, Tag,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard',          icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
  { href: '/routers',            icon: Wifi,            label: 'Routeurs' },
  { href: '/vouchers/generate',  icon: Ticket,          label: 'Générer des tickets' },
  { href: '/vouchers',           icon: Ticket,          label: 'Tickets', exact: true },
  { href: '/resellers',          icon: Users,           label: 'Revendeurs' },
  { href: '/plans',              icon: Tag,             label: 'Forfaits' },
  { href: '/sessions',           icon: Activity,        label: 'Sessions actives' },
  { href: '/transactions',       icon: CreditCard,      label: 'Transactions' },
  { href: '/analytics',          icon: BarChart3,       label: 'Rapports' },
  { href: '/settings',           icon: Settings,        label: 'Paramètres' },
];

export function Sidebar() {
  const pathname = usePathname();

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const user = (meData as any)?.data?.data;

  return (
    <aside className="w-60 flex-shrink-0 border-r bg-card flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <Wifi className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-bold text-sm leading-none">MikroServer</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">WiFi Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2">Navigation</p>
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">
              {user ? user.firstName?.[0]?.toUpperCase() : '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">
              {user ? `${user.firstName} ${user.lastName}` : '...'}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.role ?? ''}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
