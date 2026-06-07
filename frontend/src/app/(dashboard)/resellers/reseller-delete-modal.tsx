'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { DashboardModalShell } from '@/components/dashboard/dashboard-modal-shell';

interface ResellerDeleteModalProps {
  open: boolean;
  resellerName: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResellerDeleteModal({
  open,
  resellerName,
  isPending,
  onClose,
  onConfirm,
}: ResellerDeleteModalProps) {
  if (!open) {
    return null;
  }

  return (
    <DashboardModalShell
      title="Supprimer cet utilisateur"
      description="Cette action retire le compte de l'interface active. Elle reste reservee aux profils les plus privilegies."
      onClose={onClose}
      maxWidthClassName="max-w-lg"
    >
      <div className="space-y-5">
        <div className="rounded-[24px] border border-destructive/20 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Action sensible</p>
              <p className="mt-1.5 text-sm text-destructive/80">
                Le compte de{' '}
                <span className="font-semibold text-destructive">{resellerName}</span>{' '}
                sera masqué du tableau de bord. Cette action est réservée au Super Admin.
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
