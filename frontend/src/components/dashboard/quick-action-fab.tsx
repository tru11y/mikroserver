'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Ticket, Wifi, Activity, X, Command } from 'lucide-react';
import { clsx } from 'clsx';

// Pages where FAB would conflict with critical form actions
const HIDE_FAB_PATHS = ['/vouchers/generate', '/vouchers/verify', '/login', '/forgot-password', '/reset-password'];

const FAB_SIZE = 56; // h-14 w-14
const DRAG_THRESHOLD = 5; // px before a press becomes a drag
const POS_STORAGE_KEY = 'fab-position';

interface QuickActionFabProps {
  onOpenCaisse?: () => void;
}

type Position = { x: number; y: number };

function clampToViewport(x: number, y: number): Position {
  const maxX = window.innerWidth - FAB_SIZE - 8;
  const maxY = window.innerHeight - FAB_SIZE - 8;
  return {
    x: Math.min(Math.max(8, x), Math.max(8, maxX)),
    y: Math.min(Math.max(8, y), Math.max(8, maxY)),
  };
}

export function QuickActionFab({ onOpenCaisse }: QuickActionFabProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const pathname = usePathname();

  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const shouldHide = HIDE_FAB_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  // Restore saved position
  useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Position;
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          setPos(clampToViewport(parsed.x, parsed.y));
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Keep on-screen after resize
  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos((cur) => (cur ? clampToViewport(cur.x, cur.y) : cur));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pos]);

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

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const st = dragState.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    st.moved = true;
    setDragging(true);
    setOpen(false);
    setPos(clampToViewport(st.originX + dx, st.originY + dy));
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const st = dragState.current;
    if (!st || st.pointerId !== e.pointerId) return;
    dragState.current = null;
    if (st.moved) {
      setDragging(false);
      setPos((cur) => {
        if (cur) {
          try { localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(cur)); } catch { /* ignore */ }
        }
        return cur;
      });
    } else {
      setOpen((p) => !p);
    }
  };

  const fabStyle = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined;

  // Anchor the drawer to the FAB when it has been moved, opening above it.
  const drawerStyle = pos
    ? {
        right: Math.max(8, (typeof window !== 'undefined' ? window.innerWidth : 0) - (pos.x + FAB_SIZE)),
        bottom: Math.max(8, (typeof window !== 'undefined' ? window.innerHeight : 0) - pos.y + 12),
        left: 'auto' as const,
        top: 'auto' as const,
      }
    : undefined;

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
        style={drawerStyle}
        className={clsx(
          'fixed z-50 transition-all duration-200 ease-out',
          !pos && 'inset-x-3 bottom-[calc(9rem+env(safe-area-inset-bottom))] md:inset-auto md:bottom-24 md:right-6',
          pos && 'w-[min(20rem,calc(100vw-1.5rem))]',
          'md:w-80',
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
            {[
              { icon: Activity, label: 'Sessions actives', hint: 'Voir / couper', href: '/sessions' },
              { icon: Wifi,     label: 'Routeurs',          hint: 'Statut + sync', href: '/routers'  },
            ].map((action) => {
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={fabStyle}
        className={clsx(
          'fixed z-50 h-14 w-14 rounded-full shadow-lg shadow-primary/30 tap-transparent touch-none select-none',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'flex items-center justify-center transition-colors',
          dragging ? 'cursor-grabbing scale-105' : 'cursor-grab active:scale-95',
          !pos && 'right-4 md:right-6 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6',
        )}
        aria-label={open ? 'Fermer actions rapides' : 'Ouvrir actions rapides (glisser pour déplacer)'}
        aria-expanded={open ? 'true' : 'false'}
      >
        <Plus className={clsx('h-6 w-6 transition-transform duration-200 pointer-events-none', open && 'rotate-45')} strokeWidth={2.5} />
      </button>
    </>
  );
}
