'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfDay, subDays } from 'date-fns';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import type { PeriodOption } from '@/components/ui/period-shortcut';
import type {
  Transaction,
  TransactionListResponse,
  TransactionStatusFilter,
  TransactionSummary,
} from './transaction.types';

const PAGE_LIMIT = 20;

function resolveDateRange(
  periodKey: string,
): { from?: string; to?: string } {
  const days =
    periodKey === '7j' ? 7
    : periodKey === '30j' ? 30
    : periodKey === '90j' ? 90
    : 0;

  if (!days) return {};

  return {
    from: startOfDay(subDays(new Date(), days)).toISOString(),
    to: new Date().toISOString(),
  };
}

export function useTransactionsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] =
    useState<TransactionStatusFilter>('ALL');
  const [periodKey, setPeriodKey] = useState('30j');

  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser = meData
    ? unwrap<Record<string, unknown>>(meData)
    : null;
  const canExport = hasPermission(currentUser, 'transactions.export');

  const dateRange = resolveDateRange(periodKey);

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
  } = useQuery({
    queryKey: ['transactions', 'summary'],
    queryFn: () => api.transactions.summary(),
    staleTime: 60_000,
  });
  const summary = summaryData
    ? unwrap<TransactionSummary>(summaryData)
    : null;

  const {
    data: listData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['transactions', 'list', page, statusFilter, periodKey],
    queryFn: () =>
      api.transactions.list(page, PAGE_LIMIT, {
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        ...dateRange,
      }),
  });

  const listResult = listData
    ? unwrap<TransactionListResponse>(listData)
    : null;

  const transactions: Transaction[] = listResult?.data ?? [];
  const total: number = listResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const handleStatusChange = (s: TransactionStatusFilter) => {
    setStatusFilter(s);
    setPage(1);
  };

  const handlePeriodChange = (option: PeriodOption) => {
    setPeriodKey(option.key);
    setPage(1);
  };

  return {
    transactions,
    summary,
    isSummaryLoading,
    isSummaryError,
    isLoading,
    isError,
    refetch,
    page,
    totalPages,
    total,
    setPage,
    statusFilter,
    periodKey,
    handleStatusChange,
    handlePeriodChange,
    canExport,
    currentUser,
  };
}
