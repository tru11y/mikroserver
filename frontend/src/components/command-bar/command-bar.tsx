'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Search, LayoutDashboard, Wifi, Ticket, Users, BarChart3, Settings,
  Plus, Activity, RefreshCw, Ban, Shield, ChevronRight, Loader2,
} from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import { customersApi } from '@/lib/api/customers';

// ─── Types ──────────────────────────────────────────────────────────────────
interface CommandItem {
  id: string;
  type: 'nav' | 'action' | 'router' | 'customer' | 'voucher';
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  keywords?: string;
  onSelect: () => void;
}

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
  onOpenCaisse: () => void;
}

// ─── Static nav items ───────────────────────────────────────────────────────
function useNavItems(router: ReturnType<typeof useRouter>, onClose: () => void): CommandItem[] {
  return [
    { id: 'nav-dashboard', type: 'nav', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" />, onSelect: () => { router.push('/dashboard'); onClose(); } },
    { id: 'nav-routers',   type: 'nav', label: 'Routeurs',        icon: <Wifi className="h-4 w-4" />,           onSelect: () => { router.push('/routers'); onClose(); } },
    { id: 'nav-tickets',   type: 'nav', label: 'Tickets',         icon: <Ticket className="h-4 w-4" />,         onSelect: () => { router.push('/vouchers'); onClose(); } },
    { id: 'nav-clients',   type: 'nav', label: 'Clients',         icon: <Users className="h-4 w-4" />,          onSelect: () => { router.push('/customers'); onClose(); } },
    { id: 'nav-insights',  type: 'nav', label: 'Insights',        icon: <BarChart3 className="h-4 w-4" />,      onSelect: () => { router.push('/analytics'); onClose(); } },
    { id: 'nav-sessions',  type: 'nav', label: 'Sessions actives',icon: <Activity className="h-4 w-4" />,       onSelect: () => { router.push('/sessions'); onClose(); } },
    { id: 'nav-settings',  type: 'nav', label: 'Réglages',        icon: <Settings className="h-4 w-4" />,       onSelect: () => { router.push('/settings'); onClose(); } },
  ];
}

// ─── Component ──────────────────────────────────────────────────────────────
export function CommandBar({ open, onClose, onOpenCaisse }: CommandBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const navItems = useNavItems(router, onClose);

  // Dynamic: routers
  const { data: routersData } = useQuery({
    queryKey: ['cmd-routers'],
    queryFn: () => api.routers.list(),
    enabled: open,
    staleTime: 30_000,
  });

  // Dynamic: customers (only when query ≥ 2 chars)
  const { data: customersData, isFetching: isFetchingCustomers } = useQuery({
    queryKey: ['cmd-customers', query],
    queryFn: () => customersApi.findAll({ search: query, limit: 5 }),
    enabled: open && query.length >= 2,
    staleTime: 5_000,
  });

  const routers = routersData ? (unwrap<{ data?: unknown[] }>(routersData)?.data ?? unwrap<unknown[]>(routersData) ?? []) as Array<{ id: string; name: string; status: string; location?: string | null }> : [];
  const customers = customersData ? ((customersData.data as { data: { items: Array<{ id: string; macAddress: string; firstName?: string | null; lastUsername?: string | null; router: { name: string } }> } }).data?.items ?? []) : [];

  const routerItems: CommandItem[] = routers
    .filter((r) => !query || r.name.toLowerCase().includes(query.toLowerCase()) || (r.location ?? '').toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6)
    .map((r) => ({
      id: `router-${r.id}`,
      type: 'router' as const,
      label: r.name,
      sublabel: r.status === 'ONLINE' ? 'En ligne' : r.status === 'OFFLINE' ? 'Hors ligne' : r.status,
      keywords: r.location ?? '',
      icon: (
        <span className={clsx('h-1.5 w-1.5 rounded-full', r.status === 'ONLINE' ? 'bg-emerald-500' : r.status === 'DEGRADED' ? 'bg-amber-500' : 'bg-red-500')} />
      ),
      onSelect: () => { router.push(`/routers/${r.id}`); onClose(); },
    }));

  const customerItems: CommandItem[] = customers.map((c) => ({
    id: `customer-${c.id}`,
    type: 'customer' as const,
    label: c.firstName ? `${c.firstName}` : (c.lastUsername ?? c.macAddress),
    sublabel: c.macAddress,
    icon: <Users className="h-3.5 w-3.5" />,
    onSelect: () => { router.push(`/customers/${c.id}`); onClose(); },
  }));

  const actionItems: CommandItem[] = [
    {
      id: 'action-caisse',
      type: 'action',
      label: 'Générer un ticket',
      sublabel: 'Mode Caisse — 2 clics',
      keywords: 'voucher ticket generate caisse',
      icon: <Plus className="h-4 w-4 text-primary" />,
      onSelect: () => { onClose(); onOpenCaisse(); },
    },
    {
      id: 'action-sessions',
      type: 'action',
      label: 'Sessions actives',
      sublabel: 'Voir et couper des sessions',
      keywords: 'session kick couper',
      icon: <Activity className="h-4 w-4" />,
      onSelect: () => { router.push('/sessions'); onClose(); },
    },
    {
      id: 'action-sync-all',
      type: 'action',
      label: 'Sync tous les routeurs',
      sublabel: 'Depuis la page Routeurs',
      keywords: 'sync refresh routeur',
      icon: <RefreshCw className="h-4 w-4" />,
      onSelect: () => { router.push('/routers'); onClose(); },
    },
  ];

  const q = query.toLowerCase().trim();

  const filtered: CommandItem[] = q
    ? [
        ...actionItems.filter((i) =>
          i.label.toLowerCase().includes(q) ||
          (i.sublabel ?? '').toLowerCase().includes(q) ||
          (i.keywords ?? '').toLowerCase().includes(q),
        ),
        ...navItems.filter((i) => i.label.toLowerCase().includes(q)),
        ...routerItems,
        ...customerItems,
      ]
    : [...actionItems, ...navItems, ...routerItems];

  // ─── Keyboard nav ──────────────────────────────────────────────────────
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); filtered[activeIndex]?.onSelect(); return; }
  }, [filtered, activeIndex, onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleKey]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const groupLabel = (type: CommandItem['type']) => {
    if (type === 'action') return 'Actions rapides';
    if (type === 'nav') return 'Navigation';
    if (type === 'router') return 'Routeurs';
    if (type === 'customer') return 'Clients';
    return '';
  };

  let lastType: string | null = null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Barre de commandes"
        className="fixed z-50 left-1/2 top-[15vh] -translate-x-1/2 w-full max-w-xl mx-3"
      >
        <div className="rounded-xl border bg-card shadow-2xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 border-b">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher, naviguer, agir…"
              className="flex-1 py-4 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
              spellCheck={false}
            />
            {isFetchingCustomers && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Aucun résultat pour &ldquo;{query}&rdquo;
              </div>
            )}
            {filtered.map((item, idx) => {
              const showGroup = item.type !== lastType;
              if (showGroup) lastType = item.type;
              const isActive = idx === activeIndex;
              return (
                <div key={item.id}>
                  {showGroup && (
                    <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {groupLabel(item.type)}
                    </p>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={item.onSelect}
                    className={clsx(
                      'w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                      isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60',
                    )}
                  >
                    <span className={clsx('h-8 w-8 rounded-md flex items-center justify-center shrink-0', isActive ? 'bg-primary/15' : 'bg-muted')}>
                      {item.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{item.label}</span>
                      {item.sublabel && (
                        <span className="block text-[11px] text-muted-foreground truncate">{item.sublabel}</span>
                      )}
                    </span>
                    <ChevronRight className={clsx('h-3.5 w-3.5 shrink-0 transition-opacity', isActive ? 'opacity-100 text-primary' : 'opacity-0')} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-4 border-t px-4 py-2">
            {[['↑↓', 'naviguer'], ['↵', 'ouvrir'], ['ESC', 'fermer']].map(([key, hint]) => (
              <span key={key} className="flex items-center gap-1">
                <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">{key}</kbd>
                <span className="text-[10px] text-muted-foreground">{hint}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
