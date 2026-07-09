'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { getStoredAccessToken, unwrap } from '@/lib/api/client';
import { api } from '@/lib/api';
import { apiClient } from '@/lib/api/client';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';
import {
  LayoutDashboard, Wifi, Ticket, Users, BarChart3, Settings, BookOpen, Tag,
  type LucideIcon,
} from 'lucide-react';

function getRoleFromAccessToken(): string | null {
  const token = getStoredAccessToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const norm = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(norm.padEnd(Math.ceil(norm.length / 4) * 4, '='));
    const parsed = JSON.parse(decoded) as { role?: string };
    return typeof parsed.role === 'string' ? parsed.role : null;
  } catch {
    return null;
  }
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: sidebarSub } = useQuery({
    queryKey: ['operator-subscription'],
    queryFn: async () => {
      const res = await apiClient.get('/saas/subscription');
      return (res.data as { data: { status: string; tier?: { slug: string } } | null })?.data ?? null;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: sidebarUsage } = useQuery({
    queryKey: ['saas-usage'],
    queryFn: async () => {
      const res = await apiClient.get('/saas/usage');
      return (res.data as { data: Record<string, { current: number; limit: number | null }> | null })?.data ?? null;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const nearLimit =
    sidebarSub?.status === 'ACTIVE' &&
    sidebarSub?.tier?.slug !== 'enterprise' &&
    sidebarUsage !== null &&
    sidebarUsage !== undefined &&
    (['routers', 'resellers', 'monthlyTx'] as const).some((key) => {
      const meter = sidebarUsage[key];
      return meter?.limit != null && meter.current >= meter.limit * 0.8;
    });

  const user = meData ? unwrap<Record<string, unknown>>(meData) : undefined;
  const fallbackRole = !user ? getRoleFromAccessToken() : null;
  const isFallbackAdmin = fallbackRole === 'ADMIN' || fallbackRole === 'SUPER_ADMIN';
  const isFallbackReseller = fallbackRole === 'RESELLER' || fallbackRole === 'VIEWER';

  const canViewRouters = user
    ? hasAnyPermission(user, ['routers.view', 'routers.manage', 'routers.live_stats'])
    : isFallbackAdmin || isFallbackReseller;
  const canViewTickets = user
    ? hasPermission(user, 'tickets.view') || hasPermission(user, 'tickets.create')
    : isFallbackAdmin || isFallbackReseller;
  const canViewCustomers = user
    ? hasAnyPermission(user, ['users.view', 'users.manage'])
    : isFallbackAdmin || isFallbackReseller;
  const canViewInsights = user
    ? hasAnyPermission(user, ['reports.view', 'reports.export', 'audit.view'])
    : isFallbackAdmin || isFallbackReseller;
  const canViewSettings = user
    ? hasAnyPermission(user, ['settings.view', 'settings.manage'])
    : isFallbackAdmin || fallbackRole === 'VIEWER';
  const canViewAccounting = user
    ? hasAnyPermission(user, ['reports.view', 'reports.export'])
    : isFallbackAdmin;
  const canViewPlans = user
    ? hasAnyPermission(user, ['plans.view', 'plans.manage'])
    : isFallbackAdmin;

  const navItems: NavItem[] = [
    { href: '/dashboard', exact: true, icon: LayoutDashboard, label: 'Accueil' },
    ...(canViewRouters ? [{ href: '/routers',     icon: Wifi,        label: 'Routeurs'      }] : []),
    ...(canViewTickets ? [{ href: '/vouchers',    icon: Ticket,      label: 'Tickets'       }] : []),
    ...(canViewPlans ? [{ href: '/plans',         icon: Tag,         label: 'Forfaits'      }] : []),
    ...(canViewCustomers ? [{ href: '/customers', icon: Users,       label: 'Clients'       }] : []),
    ...(canViewInsights ? [{ href: '/analytics',  icon: BarChart3,   label: 'Insights'      }] : []),
    ...(canViewAccounting ? [{ href: '/accounting', icon: BookOpen,  label: 'Comptabilité'  }] : []),
    ...(canViewSettings ? [{ href: '/settings',   icon: Settings,    label: 'Réglages'      }] : []),
  ];

  const isInsightsPath = (p: string) =>
    p === '/analytics' || p.startsWith('/analytics/') ||
    p.startsWith('/audit') || p.startsWith('/incidents');
  const isClientsPath = (p: string) =>
    p.startsWith('/customers') || p.startsWith('/resellers') || p.startsWith('/users') || p.startsWith('/operators');
  const isSettingsPath = (p: string) =>
    p === '/settings' || p.startsWith('/settings/') || p.startsWith('/subscription');
  const isTicketsPath = (p: string) =>
    p === '/vouchers' || p.startsWith('/vouchers/');

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    switch (item.href) {
      case '/analytics': return isInsightsPath(pathname);
      case '/customers': return isClientsPath(pathname);
      case '/settings':  return isSettingsPath(pathname);
      case '/vouchers':  return isTicketsPath(pathname);
      default:           return pathname === item.href || pathname.startsWith(item.href + '/');
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'w-56 flex-shrink-0 border-r bg-card flex flex-col',
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:translate-x-0 md:z-auto',
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Wifi className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight">MikroServer</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = isItemActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.25 : 1.75} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {nearLimit && (
          <div className="mx-2 mb-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-3">
            <p className="text-xs font-semibold text-amber-500">Limite proche</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Passez au plan supérieur</p>
            <Link
              href="/subscription"
              className="mt-1.5 block text-xs font-semibold text-amber-500 hover:underline"
            >
              Voir les plans →
            </Link>
          </div>
        )}

        {/* User */}
        <div className="p-2 border-t flex-shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">
                {user ? (user.firstName as string | undefined)?.[0]?.toUpperCase() ?? '?' : '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">
                {user ? `${user.firstName as string} ${user.lastName as string}` : '...'}
              </p>
              <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider">
                {(user?.role as string) ?? ''}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
