'use client';

import { useHotspotIpBindingsManagement } from './use-hotspot-ip-bindings-management';
import { useHotspotProfileChange } from './use-hotspot-profile-change';
import { useHotspotProfileConfigManagement } from './use-hotspot-profile-config-management';

interface UseRouterHotspotManagementOptions {
  id: string;
  routerHotspotServer?: string;
  availableHotspotProfileNames: string[];
}

export function useRouterHotspotManagement({
  id,
  routerHotspotServer,
  availableHotspotProfileNames,
}: UseRouterHotspotManagementOptions) {
  const profileChange = useHotspotProfileChange({
    id,
    availableHotspotProfileNames,
  });
  const ipBindings = useHotspotIpBindingsManagement({
    id,
    routerHotspotServer,
  });
  const profileConfig = useHotspotProfileConfigManagement({ id });

  return {
    ...profileChange,
    ...ipBindings,
    ...profileConfig,
  };
}
