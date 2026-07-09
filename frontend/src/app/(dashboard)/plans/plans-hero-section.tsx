import { Plus, Tag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PlansHeroSectionProps {
  totalActive: number;
  totalArchived: number;
  canManage: boolean;
  isLoading: boolean;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
  onCreate: () => void;
}

export function PlansHeroSection({
  totalActive,
  totalArchived,
  canManage,
  isLoading,
  showArchived,
  onShowArchivedChange,
  onCreate,
}: PlansHeroSectionProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary)/0.08)]"
          aria-hidden="true"
        >
          <Tag className="h-5 w-5 text-[hsl(var(--primary))]" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Forfaits WiFi</h1>
          {isLoading ? (
            <Skeleton className="mt-1 h-3 w-40" />
          ) : (
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalActive} actif{totalActive !== 1 ? 's' : ''}
              {totalArchived > 0 &&
                ` · ${totalArchived} archivé${totalArchived !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Switch "Voir archivés" */}
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => onShowArchivedChange(e.target.checked)}
            className="sr-only"
            aria-label="Voir les forfaits archivés"
          />
          <span
            aria-hidden="true"
            className={[
              'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full',
              'border-2 border-transparent transition-all duration-200 ease-out',
              'focus-within:ring-2 focus-within:ring-[hsl(var(--ring))] focus-within:ring-offset-2 focus-within:ring-offset-background',
              showArchived ? 'bg-[hsl(var(--primary))]' : 'bg-muted',
            ].join(' ')}
          >
            <span
              className={[
                'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200',
                showArchived ? 'translate-x-4' : 'translate-x-0',
              ].join(' ')}
            />
          </span>
          Voir archivés
        </label>

        {canManage && (
          <button
            type="button"
            onClick={onCreate}
            className={[
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
              'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]',
              'transition-all duration-200 ease-out',
              'hover:bg-[hsl(var(--primary-hover))] hover:shadow-[var(--shadow-glow)]',
              'active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            ].join(' ')}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nouveau forfait
          </button>
        )}
      </div>
    </header>
  );
}
