'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { getStoredAccessToken } from '@/lib/api/client';
import { api } from '@/lib/api';
import { apiClient } from '@/lib/api/client';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';
import {
  LayoutDashboard, Wifi, CreditCard, Ticket,
  BarChart3, Settings, Activity, Users, Tag, ShieldCheck, AlertTriangle, History,
  Bell, Receipt, Crown, Palette, Store, Key,
  type LucideIcon,
} from 'lucide-react';

function getRoleFromAccessToken(): string | null {
  const token = getStoredAccessToken();
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='));
    const parsedPayload = JSON.parse(decodedPayload) as { role?: string };
    return typeof parsedPayload.role === 'string' ? parsedPayload.role : null;
  } catch {
    return null;
  }
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

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
      return (res.data as any)?.data ?? null;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: sidebarUsage } = useQuery({
    queryKey: ['saas-usage'],
    queryFn: async () => {
      const res = await apiClient.get('/saas/usage');
      return (res.data as any)?.data ?? null;
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
      const meter = sidebarUsage[key] as { current: number; limit: number | null } | undefined;
      return meter?.limit != null && meter.current >= meter.limit * 0.8;
    });

  const user = (meData as any)?.data?.data;
  const fallbackRole = !user ? getRoleFromAccessToken() : null;
  const isFallbackAdmin = fallbackRole === 'ADMIN' || fallbackRole === 'SUPER_ADMIN';
  const isFallbackReseller = fallbackRole === 'RESELLER' || fallbackRole === 'VIEWER';

  const canViewRouters = user
    ? hasAnyPermission(user, ['routers.view', 'routers.manage', 'routers.live_stats'])
    : isFallbackAdmin || isFallbackReseller;
  const canViewTickets = user
    ? hasPermission(user, 'tickets.view')
    : isFallbackAdmin || isFallbackReseller;
  const canGenerateTickets = user
    ? hasPermission(user, 'tickets.create')
    : isFallbackAdmin || fallbackRole === 'RESELLER';
  const canVerifyTickets = user
    ? hasPermission(user, 'tickets.verify')
    : isFallbackAdmin || isFallbackReseller;
  const canViewUsers = user
    ? hasAnyPermission(user, ['users.view', 'users.manage'])
    : isFallbackAdmin;
  const canViewPlans = user
    ? hasAnyPermission(user, ['plans.view', 'plans.manage'])
    : isFallbackAdmin || isFallbackReseller;
  const canViewSessions = user
    ? hasAnyPermission(user, ['sessions.view', 'sessions.terminate'])
    : isFallbackAdmin || isFallbackReseller;
  const canViewTransactions = user
    ? hasPermission(user, 'transactions.view')
    : isFallbackAdmin || isFallbackReseller;
  const canViewReports = user
    ? hasAnyPermission(user, ['reports.view', 'reports.export'])
    : isFallbackAdmin || isFallbackReseller;
  const canViewAudit = user
    ? hasPermission(user, 'audit.view')
    : isFallbackAdmin;
  const canViewSettings = user
    ? hasAnyPermission(user, ['settings.view', 'settings.manage'])
    : isFallbackAdmin || fallbackRole === 'VIEWER';
  const canViewCustomers = user
    ? hasAnyPermission(user, ['users.view', 'users.manage'])
    : isFallbackAdmin || isFallbackReseller;
  const isSuperAdmin = user ? user.role === 'SUPER_ADMIN' : fallbackRole === 'SUPER_ADMIN';
  const isReseller = user ? user.role === 'RESELLER' : fallbackRole === 'RESELLER';

  type NavItem = {
    href: string;
    exact?: boolean;
    icon: LucideIcon;
    label: string;
    subItem?: boolean;
    separator?: boolean;
  };

  const navItems: NavItem[] = [
    { href: '/dashboard', exact: true, icon: LayoutDashboard, label: 'Tableau de bord' },
    ...(isReseller ? [{ href: '/reseller', exact: true, icon: Store, label: 'Mon espace' }] : []),
    ...(canViewRouters
      ? [
          { href: '/routers', icon: Wifi, label: 'Routeurs' },
          { href: '/hotspot', icon: ShieldCheck, label: 'Hotspot Ops' },
          ...(canViewSessions ? [{ href: '/sessions', icon: Activity, label: 'Sessions actives' }] : []),
        ]
      : []),
    ...(canGenerateTickets || canViewTickets || canVerifyTickets
      ? [
          { href: '/vouchers', exact: true, icon: Ticket, label: 'Tickets', separator: !(canViewRouters) },
          ...(canGenerateTickets ? [{ href: '/vouchers/generate', icon: Ticket, label: 'Générer', subItem: true }] : []),
          ...(canViewTickets ? [{ href: '/vouchers/stock', icon: Ticket, label: 'Stock', subItem: true }] : []),
          ...(canVerifyTickets ? [{ href: '/vouchers/verify', icon: ShieldCheck, label: 'Vérifier', subItem: true }] : []),
        ]
      : []),
    ...(canViewPlans ? [{ href: '/plans', icon: Tag, label: 'Forfaits' }] : []),
    ...(canViewCustomers ? [{ href: '/customers', icon: Users, label: 'Clients' }] : []),
    ...(isSuperAdmin ? [
      { href: '/operators', icon: Crown, label: 'Opérateurs', separator: true },
      { href: '/users', icon: Users, label: 'Utilisateurs', subItem: true },
    ] : []),
    ...(canViewUsers ? [{ href: '/resellers', icon: Users, label: 'Revendeurs' }] : []),
    { href: '/notifications', icon: Bell, label: 'Notifications', separator: true },
    ...(canViewTransactions
      ? [{ href: '/transactions', icon: CreditCard, label: 'Transactions' }]
      : []),
    ...(canViewReports ? [{ href: '/incidents', icon: AlertTriangle, label: 'Incidents' }] : []),
    ...(canViewReports ? [{ href: '/analytics', icon: BarChart3, label: 'Rapports' }] : []),
    ...(canViewAudit ? [{ href: '/audit', icon: History, label: "Journal d'audit" }] : []),
    ...(canViewUsers ? [{ href: '/accounting', icon: Receipt, label: 'Comptabilité' }] : []),
    ...(canViewUsers ? [{ href: '/subscription', icon: Crown, label: 'Abonnement' }] : []),
    ...(canViewSettings
      ? [
          { href: '/settings', exact: true, icon: Settings, label: 'Paramètres', separator: true },
          { href: '/settings/2fa', icon: ShieldCheck, label: 'Double authentif.', subItem: true },
          { href: '/settings/white-label', icon: Palette, label: 'Personnalisation', subItem: true },
          { href: '/settings/api-keys', icon: Key, label: 'Clés API', subItem: true },
        ]
      : []),
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'w-64 flex-shrink-0 border-r bg-card flex flex-col',
          // Mobile: fixed overlay, slide in from left
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible, in-flow
          'md:relative md:translate-x-0 md:z-auto',
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b flex-shrink-0">
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
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2">
            Navigation
          </p>
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <div key={item.href}>
                {item.separator && (
                  <div className="my-1.5 border-t border-border/50" />
                )}
                <Link
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3 rounded-xl text-sm font-medium transition-all',
                    item.subItem ? 'px-3 py-1.5 ml-3' : 'px-3 py-2.5',
                    isActive
                      ? item.subItem
                        ? 'text-primary font-semibold'
                        : 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                      : item.subItem
                        ? 'text-muted-foreground hover:text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className={clsx('flex-shrink-0', item.subItem ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Near-limit upgrade CTA */}
        {nearLimit && (
          <div className="mx-3 mb-2 rounded-xl bg-orange-500/10 border border-orange-500/20 p-3">
            <p className="text-xs font-semibold text-orange-400">Limite presque atteinte</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Passez au plan supérieur</p>
            <Link
              href="/subscription"
              className="mt-2 block text-center text-xs font-bold text-orange-400 hover:underline"
            >
              Voir les plans →
            </Link>
          </div>
        )}

        {/* User info */}
        <div className="p-3 border-t flex-shrink-0">
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
    </>
  );
}
