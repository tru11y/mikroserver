'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import { hasPermission, type PermissionAwareUser } from '@/lib/permissions';
import { useAuditLogs } from './use-audit-logs';
import { AuditHeroSection } from './audit-hero-section';
import { AuditFiltersSection, type AuditFilters } from './audit-filters-section';
import { AuditLogSection } from './audit-log-section';
import { AuditWarningBanner } from './audit-warning-banner';
import type { AuditSummary, AuditPagination } from './audit.types';

const EMPTY_SUMMARY: AuditSummary = {
  total: 0,
  today: 0,
  create: 0,
  update: 0,
  delete: 0,
  security: 0,
};

const EMPTY_PAGINATION: AuditPagination = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 1,
};

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildInitialFilters(): AuditFilters {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  return {
    search: '',
    action: '',
    entityType: '',
    startDate: formatDateInput(weekStart),
    endDate: formatDateInput(now),
    activePeriodKey: '7j',
  };
}

export function AuditPageClient() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditFilters>(buildInitialFilters);

  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['audit-me'],
    queryFn: () => api.auth.me(),
  });

  const currentUser = meData ? unwrap<PermissionAwareUser>(meData) : null;
  const canView = hasPermission(currentUser, 'audit.view');

  const { data: audit, isLoading, isError, refetch } = useAuditLogs(
    {
      page,
      limit: 25,
      action: filters.action || undefined,
      entityType: filters.entityType || undefined,
      search: filters.search || undefined,
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    canView,
  );

  const handleFiltersChange = (patch: Partial<AuditFilters>) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  if (isMeLoading) {
    return (
      <div
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
        aria-busy="true"
        aria-label="Chargement en cours"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border/60 bg-muted" />
        ))}
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center" role="alert">
        <History className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold">Accès limité</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ton profil ne permet pas de consulter le journal d&apos;audit.
        </p>
      </div>
    );
  }

  const summary = audit?.summary ?? EMPTY_SUMMARY;
  const pagination = audit?.pagination ?? EMPTY_PAGINATION;
  const items = audit?.items ?? [];
  const availableActions = audit?.filters.actions ?? [];
  const availableEntityTypes = audit?.filters.entityTypes ?? [];

  return (
    <div className="space-y-5">
      <AuditHeroSection summary={summary} isLoading={isLoading} />

      <AuditFiltersSection
        filters={filters}
        availableActions={availableActions}
        availableEntityTypes={availableEntityTypes}
        onChange={handleFiltersChange}
      />

      <AuditLogSection
        items={items}
        pagination={pagination}
        summary={summary}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onPageChange={setPage}
      />

      <AuditWarningBanner />
    </div>
  );
}
