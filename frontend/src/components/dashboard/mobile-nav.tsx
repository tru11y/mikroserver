'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wifi, Ticket, Users, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';

const tabs = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Accueil',  exact: true  },
  { href: '/routers',   icon: Wifi,            label: 'Routeurs', exact: false },
  { href: '/vouchers',  icon: Ticket,          label: 'Tickets',  exact: false },
  { href: '/customers', icon: Users,           label: 'Clients',  exact: false },
  { href: '/analytics', icon: BarChart3,       label: 'Insights', exact: false },
];

const insightsPaths = ['/analytics', '/audit', '/incidents'];
const clientsPaths = ['/customers', '/resellers', '/users', '/operators'];

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    if (href === '/analytics') return insightsPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
    if (href === '/customers') return clientsPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur-sm flex items-stretch pb-safe"
      aria-label="Navigation mobile"
    >
      {tabs.map((tab) => {
        const active = isActive(tab.href, tab.exact);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-1 h-16 tap-transparent transition-colors',
              active ? 'text-primary' : 'text-muted-foreground active:text-foreground',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 1.75} />
            <span className={clsx('text-[10px] font-medium leading-none', active ? 'text-primary' : 'text-muted-foreground')}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
