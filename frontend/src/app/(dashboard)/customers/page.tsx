'use client';

import { Suspense } from 'react';
import { useCustomersPage } from './use-customers-page';
import { CustomersHeroSection } from './customers-hero-section';
import { CustomersFilterBar } from './customers-filter-bar';
import { CustomersListSection } from './customers-list-section';

function CustomersPageInner() {
  const {
    stats,
    isStatsLoading,
    items,
    total,
    isLoading,
    isError,
    refetch,
    page,
    setPage,
    totalPages,
    search,
    setSearch,
    routerId,
    setRouterId,
    routers,
    canBlock,
    onBlock,
    isBlockPending,
  } = useCustomersPage();

  return (
    <main className="space-y-4">
      <CustomersHeroSection stats={stats} isLoading={isStatsLoading} />

      <CustomersFilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); }}
        routerId={routerId}
        onRouterChange={setRouterId}
        routers={routers}
      />

      <CustomersListSection
        items={items}
        total={total}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        canBlock={canBlock}
        onBlock={onBlock}
        isBlockPending={isBlockPending}
        search={search}
      />
    </main>
  );
}

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersPageInner />
    </Suspense>
  );
}
