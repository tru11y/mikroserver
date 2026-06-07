'use client';

import { useEffect, useRef } from 'react';
import { Edit3, Trash2, Wrench } from 'lucide-react';
import type { RouterItem } from './routers.types';

interface Props {
  router: RouterItem;
  onEdit: () => void;
  onToggleMaintenance: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function RouterContextMenu({
  router,
  onEdit,
  onToggleMaintenance,
  onDelete,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    items[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      const focused = document.activeElement as HTMLElement;
      const idx = items.indexOf(focused);

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          items[(idx + 1) % items.length]?.focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          items[(idx - 1 + items.length) % items.length]?.focus();
          break;
        case 'Tab':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const itemClass =
    'w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted active:scale-[0.98] transition-all duration-150 ease-out text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))] focus-visible:bg-muted';

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden="true" />
      <div
        ref={menuRef}
        role="menu"
        aria-label={`Actions pour ${router.name}`}
        tabIndex={-1}
        className="absolute right-0 top-full mt-1 z-40 w-48 rounded-md border bg-popover shadow-lg overflow-hidden outline-none"
      >
        <button type="button" role="menuitem" onClick={onEdit} className={itemClass}>
          <Edit3 className="h-3 w-3" aria-hidden="true" />
          Modifier
        </button>
        <button type="button" role="menuitem" onClick={onToggleMaintenance} className={itemClass}>
          <Wrench className="h-3 w-3" aria-hidden="true" />
          {router.status === 'MAINTENANCE' ? 'Sortir de maintenance' : 'Passer en maintenance'}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={onDelete}
          className={`${itemClass} border-t text-destructive hover:bg-destructive/10`}
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
          Supprimer
        </button>
      </div>
    </>
  );
}
