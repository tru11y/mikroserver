'use client';

import { Plus, Shield, UserCheck, Users } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';

export function ResellersHeroSection({
  total,
  active,
  recent,
  pending,
  canManageUsers,
  onCreate,
}: {
  total: number;
  active: number;
  recent: number;
  pending: number;
  canManageUsers: boolean;
  onCreate: () => void;
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border bg-[linear-gradient(135deg,rgba(56,189,248,0.12),rgba(14,165,233,0.06),rgba(0,0,0,0))] p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300">
              <Shield className="h-3.5 w-3.5" />
              Gouvernance des acces
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Revendeurs</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Gere les comptes revendeurs, les niveaux d&apos;acces et la hygiene des sessions avec
              une lecture plus claire, plus commerciale et plus rassurante.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="#directory"
              className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              Annuaire
            </a>
            <a
              href="#filters"
              className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              Filtres
            </a>
            {canManageUsers && (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Nouveau compte
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Comptes"
          value={String(total)}
          icon={<Users className="h-4 w-4" />}
          variant="primary"
        />
        <KpiCard
          title="Actifs"
          value={String(active)}
          icon={<UserCheck className="h-4 w-4" />}
          variant="success"
        />
        <KpiCard
          title="Connexions 7j"
          value={String(recent)}
          icon={<Shield className="h-4 w-4" />}
          variant="warning"
        />
        <KpiCard
          title="En attente"
          value={String(pending)}
          icon={<Shield className="h-4 w-4" />}
          variant="danger"
        />
      </div>
    </section>
  );
}
