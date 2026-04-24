'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Server } from 'lucide-react';
import { normalizeIpBindingType } from './router-detail.utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { RouterDetailSection } from './router-detail.types';
import { ConnectedClientsSection } from './connected-clients-section';
import { HotspotIpBindingsSection } from './hotspot-ip-bindings-section';
import { HotspotIpBindingModal } from './hotspot-ip-binding-modal';
import { HotspotProfileChangeModal } from './hotspot-profile-change-modal';
import { HotspotProfileConfigModal } from './hotspot-profile-config-modal';
import { HotspotProfilesSection } from './hotspot-profiles-section';
import { RouterHotspotShortcuts } from './router-hotspot-shortcuts';
import { HotspotUsersSection } from './hotspot-users-section';
import { RouterOverviewSection } from './router-overview-section';
import { RouterSectionNav } from './router-section-nav';
import { RouterStatsWidget } from './router-stats-widget';
import { useRouterDetailData } from './use-router-detail-data';
import { useRouterLiveOperations } from './use-router-live-operations';
import { useRouterHotspotManagement } from './use-router-hotspot-management';
import { RouterMigrationSection } from './router-migration-section';
import { RouterHistorySection } from './router-history-section';
import { RouterAccessCard } from './router-access-card';
import dynamic from 'next/dynamic';
const SshTerminal = dynamic(
  () => import('@/components/ssh-terminal').then((m) => m.SshTerminal),
  { ssr: false },
);

export default function RouterDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
  const router = useRouter();
  const [activeSection, setActiveSection] =
    useState<RouterDetailSection>('users');
  const [hotspotUserSearch, setHotspotUserSearch] = useState('');
  const [confirmDeleteUsername, setConfirmDeleteUsername] = useState<string | null>(null);
  const [confirmRemoveProfileId, setConfirmRemoveProfileId] = useState<string | null>(null);
  const [confirmRemoveBindingId, setConfirmRemoveBindingId] = useState<string | null>(null);

  const {
    isMeLoading,
    canViewRouters,
    canRunHealthCheck,
    canSyncRouters,
    canManageHotspot,
    canViewPlans,
    canTerminateSessions,
    canAdminDeleteTicket,
    hasHotspotUserSearch,
    routerInfo,
    stats,
    statsLoading,
    dataUpdatedAt,
    statsErrorMessage,
    hotspotProfiles,
    hotspotProfilesLoading,
    hotspotProfilesErrorMessage,
    hotspotBindings,
    hotspotBindingsLoading,
    hotspotBindingsErrorMessage,
    hotspotUsers,
    hotspotUsersLoading,
    hotspotUsersErrorMessage,
    allPlans,
    plansWithProfileInfo,
    legacyTariffProfiles,
    availableHotspotProfileNames,
    fallbackHotspotProfileNames,
    totalTariffItems,
    filteredHotspotUsers,
    hotspotComplianceSummary,
    liveClients,
    maxBps,
    portalHref,
  } = useRouterDetailData({
    id,
    activeSection,
    hotspotUserSearch,
  });

  const {
    isChecking,
    disconnectingId,
    setDisconnectingId,
    sortCol,
    sortDir,
    sortedClients,
    toggleSort,
    syncMutation,
    healthCheck,
    disconnectMutation,
    deleteMutation,
    disconnectExpiredMutation,
  } = useRouterLiveOperations({
    id,
    liveClients,
  });

  const {
    profileTarget,
    openProfileChangeModal,
    nextProfile,
    setNextProfile,
    disconnectActiveOnProfileChange,
    setDisconnectActiveOnProfileChange,
    closeProfileChangeModal,
    updateHotspotProfileMutation,
    ipBindingTarget,
    openEditIpBindingModal,
    ipBindingType,
    setIpBindingType,
    ipBindingServer,
    setIpBindingServer,
    ipBindingAddress,
    setIpBindingAddress,
    ipBindingMacAddress,
    setIpBindingMacAddress,
    ipBindingComment,
    setIpBindingComment,
    ipBindingToAddress,
    setIpBindingToAddress,
    ipBindingAddressList,
    setIpBindingAddressList,
    ipBindingDisabled,
    setIpBindingDisabled,
    ipBindingActionId,
    setIpBindingActionId,
    closeIpBindingModal,
    isCreateIpBindingOpen,
    openCreateIpBindingModal,
    closeCreateIpBindingModal,
    newIpBindingServer,
    setNewIpBindingServer,
    newIpBindingAddress,
    setNewIpBindingAddress,
    newIpBindingMacAddress,
    setNewIpBindingMacAddress,
    newIpBindingType,
    setNewIpBindingType,
    newIpBindingComment,
    setNewIpBindingComment,
    newIpBindingToAddress,
    setNewIpBindingToAddress,
    newIpBindingAddressList,
    setNewIpBindingAddressList,
    newIpBindingDisabled,
    setNewIpBindingDisabled,
    updateIpBindingMutation,
    createIpBindingMutation,
    toggleIpBindingBlockMutation,
    toggleIpBindingEnabledMutation,
    removeIpBindingMutation,
    profileConfigTarget,
    profileConfigName,
    setProfileConfigName,
    profileConfigRateRx,
    setProfileConfigRateRx,
    profileConfigRateTx,
    setProfileConfigRateTx,
    profileConfigSharedUsers,
    setProfileConfigSharedUsers,
    profileConfigSessionTimeout,
    setProfileConfigSessionTimeout,
    profileConfigIdleTimeout,
    setProfileConfigIdleTimeout,
    profileConfigKeepaliveTimeout,
    setProfileConfigKeepaliveTimeout,
    profileConfigAddressPool,
    setProfileConfigAddressPool,
    profileActionId,
    setProfileActionId,
    isProfileConfigModalOpen,
    openCreateProfileModal,
    openEditProfileModal,
    closeProfileConfigModal,
    createHotspotProfileMutation,
    updateHotspotProfileConfigMutation,
    removeHotspotProfileMutation,
  } = useRouterHotspotManagement({
    id,
    routerHotspotServer: routerInfo?.hotspotServer,
    availableHotspotProfileNames,
  });
  const profilesSectionCount =
    hotspotProfiles.length > 0
      ? hotspotProfiles.length
      : fallbackHotspotProfileNames.length;
  const liveSectionCount =
    stats?.activeClients ?? routerInfo?.metadata?.lastActiveClients ?? 0;
  const liveUnavailable = Boolean(statsErrorMessage) && !stats;
  const profilesUnavailable =
    Boolean(hotspotProfilesErrorMessage) && profilesSectionCount === 0;
  const bindingsUnavailable =
    Boolean(hotspotBindingsErrorMessage) && hotspotBindings.length === 0;
  const usersUnavailable =
    Boolean(hotspotUsersErrorMessage) &&
    hotspotUsers.length === 0 &&
    (activeSection === 'live' || hasHotspotUserSearch);

  if (isMeLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canViewRouters) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <Server className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Acces limite</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ton profil ne permet pas de consulter les details routeur.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RouterOverviewSection
        routerInfo={routerInfo}
        stats={stats}
        statsLoading={statsLoading}
        statsErrorMessage={statsErrorMessage}
        dataUpdatedAt={dataUpdatedAt}
        maxBps={maxBps}
        portalHref={portalHref}
        canSyncRouters={canSyncRouters}
        canRunHealthCheck={canRunHealthCheck}
        isSyncPending={syncMutation.isPending}
        isChecking={isChecking}
        onBack={() => router.push('/routers')}
        onOpenPortal={() =>
          window.open(portalHref, '_blank', 'noopener,noreferrer')
        }
        onSync={() => syncMutation.mutate()}
        onHealthCheck={healthCheck}
      />

      <RouterStatsWidget routerId={id} />

      <RouterSectionNav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        statsActiveClients={liveSectionCount}
        profilesCount={profilesSectionCount}
        bindingsCount={hotspotBindings.length}
        usersCount={hotspotUsers.length}
        isLiveUnavailable={liveUnavailable}
        isProfilesUnavailable={profilesUnavailable}
        isBindingsUnavailable={bindingsUnavailable}
        isUsersUnavailable={usersUnavailable}
      />

      <RouterHotspotShortcuts
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        activeClients={liveSectionCount}
        usersCount={hotspotUsers.length}
        profilesCount={profilesSectionCount}
        bindingsCount={hotspotBindings.length}
        isLiveUnavailable={liveUnavailable}
        isProfilesUnavailable={profilesUnavailable}
        isBindingsUnavailable={bindingsUnavailable}
        isUsersUnavailable={usersUnavailable}
      />

      {activeSection === 'live' && (
        <ConnectedClientsSection
          isLoading={statsLoading}
          errorMessage={statsErrorMessage}
          hasStats={Boolean(stats)}
          clients={sortedClients}
          sortCol={sortCol}
          sortDir={sortDir}
          onToggleSort={toggleSort}
          canManageHotspot={canManageHotspot}
          canTerminateSessions={canTerminateSessions}
          canAdminDeleteTicket={canAdminDeleteTicket}
          disconnectingId={disconnectingId}
          isProfileChangePending={updateHotspotProfileMutation.isPending}
          isDisconnectPending={disconnectMutation.isPending}
          isDeletePending={deleteMutation.isPending}
          isDisconnectExpiredPending={disconnectExpiredMutation.isPending}
          onChangeProfile={openProfileChangeModal}
          onDisconnect={(clientId) => {
            setDisconnectingId(clientId);
            disconnectMutation.mutate(clientId);
          }}
          onDelete={(username) => setConfirmDeleteUsername(username)}
          onDisconnectExpired={() => disconnectExpiredMutation.mutate()}
        />
      )}

      {activeSection === 'users' && (
        <HotspotUsersSection
          canManageHotspot={canManageHotspot}
          errorMessage={hotspotUsersErrorMessage}
          searchValue={hotspotUserSearch}
          onSearchChange={setHotspotUserSearch}
          isLoading={hotspotUsersLoading}
          users={filteredHotspotUsers}
          complianceSummary={hotspotComplianceSummary}
          onChangeProfile={openProfileChangeModal}
        />
      )}

      {activeSection === 'profiles' && (
        <HotspotProfilesSection
          canManageHotspot={canManageHotspot}
          canViewPlans={canViewPlans}
          errorMessage={hotspotProfilesErrorMessage}
          isLoading={hotspotProfilesLoading}
          profiles={hotspotProfiles}
          fallbackProfileNames={fallbackHotspotProfileNames}
          totalTariffItems={totalTariffItems}
          allPlans={allPlans}
          plansWithProfileInfo={plansWithProfileInfo}
          legacyTariffProfiles={legacyTariffProfiles}
          profileActionId={profileActionId}
          isRemovePending={removeHotspotProfileMutation.isPending}
          onOpenCreate={openCreateProfileModal}
          onEdit={openEditProfileModal}
          onRemove={(profile) => setConfirmRemoveProfileId(profile.id)}
        />
      )}

      {activeSection === 'bindings' && (
        <HotspotIpBindingsSection
          canManageHotspot={canManageHotspot}
          errorMessage={hotspotBindingsErrorMessage}
          isLoading={hotspotBindingsLoading}
          bindings={hotspotBindings}
          routerHotspotServer={routerInfo?.hotspotServer}
          ipBindingActionId={ipBindingActionId}
          isToggleBlockPending={toggleIpBindingBlockMutation.isPending}
          isToggleEnabledPending={toggleIpBindingEnabledMutation.isPending}
          isRemovePending={removeIpBindingMutation.isPending}
          onOpenCreate={openCreateIpBindingModal}
          onEdit={openEditIpBindingModal}
          onToggleBlock={(binding) => {
            setIpBindingActionId(binding.id);
            toggleIpBindingBlockMutation.mutate({
              bindingId: binding.id,
              block: normalizeIpBindingType(binding.type) !== 'blocked',
            });
          }}
          onToggleEnabled={(binding) => {
            setIpBindingActionId(binding.id);
            toggleIpBindingEnabledMutation.mutate({
              bindingId: binding.id,
              disabled: !binding.disabled,
            });
          }}
          onRemove={(binding) => setConfirmRemoveBindingId(binding.id)}
        />
      )}

      {activeSection === 'migration' && routerInfo && (
        <RouterMigrationSection
          routerId={id}
          routerName={routerInfo.name}
          canManage={canManageHotspot}
        />
      )}

      {activeSection === 'history' && (
        <RouterHistorySection routerId={id} />
      )}

      {activeSection === 'access' && (
        <RouterAccessCard routerId={id} />
      )}

      {activeSection === 'terminal' && (
        <div className="rounded-xl border bg-zinc-950 overflow-hidden" style={{ height: '70vh' }}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-400">
              Terminal SSH — {routerInfo?.name ?? id} ({routerInfo?.wireguardIp})
            </span>
            <span className="text-xs text-zinc-600">Connexion via tunnel WireGuard · port 22</span>
          </div>
          <div className="h-[calc(100%-37px)] p-2">
            <SshTerminal
              routerId={id}
              accessToken={
                typeof window !== 'undefined'
                  ? (sessionStorage.getItem('access_token') ?? '')
                  : ''
              }
            />
          </div>
        </div>
      )}

      <HotspotProfileConfigModal
        profile={profileConfigTarget}
        isOpen={isProfileConfigModalOpen}
        name={profileConfigName}
        rateRx={profileConfigRateRx}
        rateTx={profileConfigRateTx}
        sharedUsers={profileConfigSharedUsers}
        sessionTimeout={profileConfigSessionTimeout}
        idleTimeout={profileConfigIdleTimeout}
        keepaliveTimeout={profileConfigKeepaliveTimeout}
        addressPool={profileConfigAddressPool}
        isPending={
          createHotspotProfileMutation.isPending ||
          updateHotspotProfileConfigMutation.isPending
        }
        onClose={closeProfileConfigModal}
        onNameChange={setProfileConfigName}
        onRateRxChange={setProfileConfigRateRx}
        onRateTxChange={setProfileConfigRateTx}
        onSharedUsersChange={setProfileConfigSharedUsers}
        onSessionTimeoutChange={setProfileConfigSessionTimeout}
        onIdleTimeoutChange={setProfileConfigIdleTimeout}
        onKeepaliveTimeoutChange={setProfileConfigKeepaliveTimeout}
        onAddressPoolChange={setProfileConfigAddressPool}
        onSubmit={() => {
          if (profileConfigTarget) {
            updateHotspotProfileConfigMutation.mutate();
            return;
          }
          createHotspotProfileMutation.mutate();
        }}
      />

      <HotspotIpBindingModal
        mode="create"
        isOpen={isCreateIpBindingOpen}
        binding={null}
        server={newIpBindingServer}
        address={newIpBindingAddress}
        macAddress={newIpBindingMacAddress}
        type={newIpBindingType}
        comment={newIpBindingComment}
        toAddress={newIpBindingToAddress}
        addressList={newIpBindingAddressList}
        disabled={newIpBindingDisabled}
        isPending={createIpBindingMutation.isPending}
        onClose={closeCreateIpBindingModal}
        onServerChange={setNewIpBindingServer}
        onAddressChange={setNewIpBindingAddress}
        onMacAddressChange={setNewIpBindingMacAddress}
        onTypeChange={setNewIpBindingType}
        onCommentChange={setNewIpBindingComment}
        onToAddressChange={setNewIpBindingToAddress}
        onAddressListChange={setNewIpBindingAddressList}
        onDisabledChange={setNewIpBindingDisabled}
        onSubmit={() => createIpBindingMutation.mutate()}
      />

      <HotspotIpBindingModal
        mode="edit"
        isOpen={Boolean(ipBindingTarget)}
        binding={ipBindingTarget}
        server={ipBindingServer}
        address={ipBindingAddress}
        macAddress={ipBindingMacAddress}
        type={ipBindingType}
        comment={ipBindingComment}
        toAddress={ipBindingToAddress}
        addressList={ipBindingAddressList}
        disabled={ipBindingDisabled}
        isPending={updateIpBindingMutation.isPending}
        onClose={closeIpBindingModal}
        onServerChange={setIpBindingServer}
        onAddressChange={setIpBindingAddress}
        onMacAddressChange={setIpBindingMacAddress}
        onTypeChange={setIpBindingType}
        onCommentChange={setIpBindingComment}
        onToAddressChange={setIpBindingToAddress}
        onAddressListChange={setIpBindingAddressList}
        onDisabledChange={setIpBindingDisabled}
        onSubmit={() => updateIpBindingMutation.mutate()}
      />

      <HotspotProfileChangeModal
        user={profileTarget}
        availableProfileNames={availableHotspotProfileNames}
        isUsingFallbackProfiles={
          hotspotProfiles.length === 0 && availableHotspotProfileNames.length > 0
        }
        nextProfile={nextProfile}
        disconnectActive={disconnectActiveOnProfileChange}
        isPending={updateHotspotProfileMutation.isPending}
        onClose={closeProfileChangeModal}
        onNextProfileChange={setNextProfile}
        onDisconnectActiveChange={setDisconnectActiveOnProfileChange}
        onSubmit={() => updateHotspotProfileMutation.mutate()}
      />

      <ConfirmDialog
        open={confirmDeleteUsername !== null}
        title={`Supprimer le ticket ${confirmDeleteUsername ?? ''} ?`}
        description="Cette action retire le ticket du routeur et l'utilisateur côté MikroTik/Winbox. L'historique est conservé si le ticket a déjà servi."
        confirmLabel="Supprimer définitivement"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (confirmDeleteUsername) deleteMutation.mutate(confirmDeleteUsername);
          setConfirmDeleteUsername(null);
        }}
        onCancel={() => setConfirmDeleteUsername(null)}
      />

      <ConfirmDialog
        open={confirmRemoveProfileId !== null}
        title={`Supprimer le profil ?`}
        description={`Supprimer le profil "${hotspotProfiles.find((p) => p.id === confirmRemoveProfileId)?.name ?? confirmRemoveProfileId}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        isLoading={removeHotspotProfileMutation.isPending}
        onConfirm={() => {
          if (confirmRemoveProfileId) {
            setProfileActionId(confirmRemoveProfileId);
            removeHotspotProfileMutation.mutate(confirmRemoveProfileId);
          }
          setConfirmRemoveProfileId(null);
        }}
        onCancel={() => setConfirmRemoveProfileId(null)}
      />

      <ConfirmDialog
        open={confirmRemoveBindingId !== null}
        title="Supprimer l'IP binding ?"
        description={(() => {
          const b = hotspotBindings.find((x) => x.id === confirmRemoveBindingId);
          const label = b ? (b.address ?? b.macAddress ?? b.id) : confirmRemoveBindingId;
          return `Supprimer le binding ${label} ? Cette action est irréversible.`;
        })()}
        confirmLabel="Supprimer"
        isLoading={removeIpBindingMutation.isPending}
        onConfirm={() => {
          if (confirmRemoveBindingId) {
            setIpBindingActionId(confirmRemoveBindingId);
            removeIpBindingMutation.mutate(confirmRemoveBindingId);
          }
          setConfirmRemoveBindingId(null);
        }}
        onCancel={() => setConfirmRemoveBindingId(null)}
      />
    </div>
  );
}
