import { Tag } from 'lucide-react';
import { PlanCardSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { PlanCard } from './plan-card';
import type { Plan } from './plans.types';

interface PlansCatalogSectionProps {
  plans: Plan[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  showArchived: boolean;
  canManage: boolean;
  onEdit: (plan: Plan) => void;
  onDuplicate: (plan: Plan) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  isDuplicating: boolean;
  isDeleting: boolean;
  isArchiving: boolean;
  isRestoring: boolean;
}

export function PlansCatalogSection({
  plans,
  isLoading,
  isError,
  onRetry,
  showArchived,
  canManage,
  onEdit,
  onDuplicate,
  onDelete,
  onArchive,
  onRestore,
  isDuplicating,
  isDeleting,
  isArchiving,
  isRestoring,
}: PlansCatalogSectionProps) {
  if (isLoading) {
    return (
      <section aria-label="Chargement des forfaits">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PlanCardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section aria-label="Erreur de chargement">
        <ErrorState
          title="Impossible de charger les forfaits"
          message="Une erreur s'est produite lors de la récupération des forfaits. Vérifiez la connexion et réessayez."
          onRetry={onRetry}
        />
      </section>
    );
  }

  if (plans.length === 0) {
    return (
      <section aria-label="Aucun forfait">
        <EmptyState
          icon={<Tag className="h-5 w-5" />}
          title={showArchived ? 'Aucun forfait archivé' : 'Aucun forfait configuré'}
          description={
            showArchived
              ? 'Les forfaits archivés apparaîtront ici.'
              : 'Créez des forfaits WiFi avec leur logique ticketing terrain.'
          }
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="plans-catalog-heading">
      <h2 id="plans-catalog-heading" className="sr-only">
        Catalogue des forfaits
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            canManage={canManage}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onArchive={onArchive}
            onRestore={onRestore}
            isDuplicating={isDuplicating}
            isDeleting={isDeleting}
            isArchiving={isArchiving}
            isRestoring={isRestoring}
          />
        ))}
      </div>
    </section>
  );
}
