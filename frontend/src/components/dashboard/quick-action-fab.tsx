'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Ticket, Wifi, Activity, X, Command } from 'lucide-react';
import { clsx } from 'clsx';

// Pages where FAB would conflict with critical form actions
const HIDE_FAB_PATHS = ['/vouchers/generate', '/vouchers/verify', '/login', '/forgot-password', '/reset-password'];

interface QuickActionFabProps {
  onOpenCaisse?: () => void;
}

export function QuickActionFab({ onOpenCaisse }: QuickActionFabProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const shouldHide = HIDE_FAB_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (shouldHide) return null;

  const linkActions = [
    { icon: Activity, label: 'Sessions actives', hint: 'Voir / couper', href: '/sessions' },
    { icon: Wifi,     label: 'Routeurs',          hint: 'Statut + sync', href: '/routers'  },
  ];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={clsx(
          'fixed z-50 transition-all duration-200 ease-out',
          'inset-x-3 bottom-[calc(9rem+env(safe-area-inset-bottom))]',
          'md:inset-auto md:bottom-24 md:right-6 md:w-80',
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none',
        )}
        role="dialog"
        aria-label="Actions rapides"
      >
        <div className="rounded-xl border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions rapides</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-1.5 space-y-0.5">
            {/* Mode Caisse — primary */}
            <button
              type="button"
              onClick={() => { setOpen(false); onOpenCaisse?.(); }}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 bg-primary/10 hover:bg-primary/15 transition-colors text-left"
            >
              <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Ticket className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary truncate">Mode Caisse</p>
                <p className="text-xs text-muted-foreground">Ticket en 2 clics</p>
              </div>
            </button>

            {/* Link actions */}
            {linkActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{action.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{action.hint}</p>
                  </div>
                </Link>
              );
            })}

            {/* Command bar hint */}
            <div className="px-3 py-2 flex items-center gap-2 text-[11px] text-muted-foreground border-t mt-1 pt-2">
              <Command className="h-3 w-3" />
              <span>Cmd+K pour la barre de commandes</span>
            </div>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={clsx(
          'fixed z-50 h-14 w-14 rounded-full shadow-lg shadow-primary/30 tap-transparent',
          'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95',
          'flex items-center justify-center transition-all',
          'right-4 md:right-6',
          'bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6',
        )}
        aria-label={open ? 'Fermer actions rapides' : 'Ouvrir actions rapides'}
        aria-expanded={open ? 'true' : 'false'}
      >
        <Plus className={clsx('h-6 w-6 transition-transform duration-200', open && 'rotate-45')} strokeWidth={2.5} />
      </button>
    </>
  );
}
