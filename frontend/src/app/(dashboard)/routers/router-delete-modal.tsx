'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { DashboardModalShell } from '@/components/dashboard/dashboard-modal-shell';
import type { RouterItem } from './routers.types';

interface RouterDeleteModalProps {
  router: RouterItem | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RouterDeleteModal({
  router,
  isPending,
  onClose,
  onConfirm,
}: RouterDeleteModalProps) {
  if (!router) {
    return null;
  }

  return (
    <DashboardModalShell
      title={`Supprimer ${router.name}`}
      description="Cette action masque le routeur du SaaS. Elle doit rester exceptionnelle et documentee."
      onClose={onClose}
      maxWidthClassName="max-w-lg"
    >
      <div className="space-y-5">
        <div className="rounded-[24px] border border-red-400/20 bg-red-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-200" />
            <div>
              <p className="font-medium text-red-100">Zone critique</p>
              <p className="mt-2 text-sm text-red-100/80">
                Le routeur disparaitra de l&apos;interface courante. Garde une trace
                d&apos;exploitation avant confirmation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-4 py-2 text-sm transition-colors hover:bg-muted/40"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {isPending ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>
    </DashboardModalShell>
  );
}
