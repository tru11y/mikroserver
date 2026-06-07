'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SessionsHeroSection } from './sessions-hero-section';
import { SessionsTableSection } from './sessions-table-section';
import { useSessionsPage } from './use-sessions-page';
import type { Session } from './use-sessions-page';

export default function SessionsPage() {
  const {
    sessions,
    routerErrors,
    totalRouters,
    respondingRouters,
    routers,
    routerId,
    setRouterId,
    isLoading,
    isFetching,
    errorMessage,
    refetch,
    canAdminDeleteTicket,
    terminatingId,
    setTerminatingId,
    deletingId,
    setDeletingId,
    confirmDeleteSession,
    setConfirmDeleteSession,
    terminateMutation,
    deleteMutation,
    isExpiringSoon,
    sortCol,
    sortDir,
    toggleSort,
  } = useSessionsPage();

  const handleTerminate = (session: Session) => {
    setTerminatingId(session.id);
    terminateMutation.mutate(session);
  };

  const handleDeleteConfirm = () => {
    if (!confirmDeleteSession) return;
    setDeletingId(confirmDeleteSession.id);
    deleteMutation.mutate(confirmDeleteSession);
  };

  return (
    <main className="space-y-6">
      <SessionsHeroSection
        sessions={sessions}
        respondingRouters={respondingRouters}
        totalRouters={totalRouters}
        isLoading={isLoading}
      />

      <SessionsTableSection
        sessions={sessions}
        routerErrors={routerErrors}
        routers={routers}
        routerId={routerId}
        onRouterChange={setRouterId}
        isLoading={isLoading}
        isFetching={isFetching}
        errorMessage={errorMessage}
        onRefetch={refetch}
        onTerminate={handleTerminate}
        onDeleteRequest={setConfirmDeleteSession}
        canAdminDeleteTicket={canAdminDeleteTicket}
        terminatingId={terminatingId}
        deletingId={deletingId}
        isTerminatePending={terminateMutation.isPending}
        isDeletePending={deleteMutation.isPending}
        isExpiringSoon={isExpiringSoon}
        sortCol={sortCol}
        sortDir={sortDir}
        onToggleSort={toggleSort}
        respondingRouters={respondingRouters}
        totalRouters={totalRouters}
      />

      <ConfirmDialog
        open={confirmDeleteSession !== null}
        title="Supprimer le ticket définitivement ?"
        description={
          confirmDeleteSession
            ? `Le ticket de "${confirmDeleteSession.username}" sera supprimé de façon permanente. Cette action est irréversible.`
            : ''
        }
        confirmLabel="Supprimer définitivement"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDeleteSession(null)}
      />
    </main>
  );
}
