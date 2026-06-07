'use client';

import { useState } from 'react';

export interface RouterConfirmActions {
  confirmDeleteUsername: string | null;
  setConfirmDeleteUsername: (username: string | null) => void;
  confirmRemoveProfileId: string | null;
  setConfirmRemoveProfileId: (id: string | null) => void;
  confirmRemoveBindingId: string | null;
  setConfirmRemoveBindingId: (id: string | null) => void;
}

export function useRouterConfirmActions(): RouterConfirmActions {
  const [confirmDeleteUsername, setConfirmDeleteUsername] = useState<string | null>(null);
  const [confirmRemoveProfileId, setConfirmRemoveProfileId] = useState<string | null>(null);
  const [confirmRemoveBindingId, setConfirmRemoveBindingId] = useState<string | null>(null);

  return {
    confirmDeleteUsername,
    setConfirmDeleteUsername,
    confirmRemoveProfileId,
    setConfirmRemoveProfileId,
    confirmRemoveBindingId,
    setConfirmRemoveBindingId,
  };
}
