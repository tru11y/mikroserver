'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
  return (
    <ConfirmDialog
      open={router !== null}
      title={router ? `Supprimer ${router.name} ?` : ''}
      description="Le routeur disparaîtra de l'interface. Cette action doit rester exceptionnelle et documentée."
      confirmLabel="Supprimer"
      isLoading={isPending}
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
