'use client';

import { useQuery } from '@tanstack/react-query';
import {
  accountingApi,
  type Invoice,
  type RevenueRouterRow,
} from '@/lib/api/accounting';

const INVOICE_LIMIT = 50;

interface InvoiceListResponse {
  items: Invoice[];
  total: number;
}

export interface AccountingKpis {
  totalPaidXof: number;
  totalPendingXof: number;
  totalOverdueXof: number;
  invoiceCount: number;
  overdueCount: number;
}

function deriveKpis(items: Invoice[], total: number): AccountingKpis {
  const agg = items.reduce(
    (acc, inv) => {
      if (inv.status === 'PAID') acc.totalPaidXof += inv.totalXof;
      else if (inv.status === 'SENT' || inv.status === 'DRAFT') acc.totalPendingXof += inv.totalXof;
      else if (inv.status === 'OVERDUE') {
        acc.totalOverdueXof += inv.totalXof;
        acc.overdueCount += 1;
      }
      return acc;
    },
    { totalPaidXof: 0, totalPendingXof: 0, totalOverdueXof: 0, overdueCount: 0 },
  );
  return { ...agg, invoiceCount: total };
}

export function useAccountingData() {
  const {
    data: routerRaw,
    isLoading: isRouterLoading,
    isError: isRouterError,
    refetch: refetchRouter,
  } = useQuery({
    queryKey: ['accounting', 'revenue-router'],
    queryFn: () => {
      const now = new Date();
      const from = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        now.getDate(),
      ).toISOString();
      return accountingApi.getRevenueByRouter({ from, to: now.toISOString() });
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: invoicesRaw,
    isLoading: isInvoicesLoading,
    isError: isInvoicesError,
    refetch: refetchInvoices,
  } = useQuery({
    queryKey: ['accounting', 'invoices', INVOICE_LIMIT],
    queryFn: () => accountingApi.getInvoices({ limit: INVOICE_LIMIT }),
    staleTime: 60_000,
  });

  const routerData: RevenueRouterRow[] =
    (routerRaw?.data as { data: RevenueRouterRow[] } | undefined)?.data ?? [];

  const invoiceList: InvoiceListResponse | null =
    (invoicesRaw?.data as { data: InvoiceListResponse } | undefined)?.data ?? null;

  const invoices: Invoice[] = invoiceList?.items ?? [];
  const invoiceTotal: number = invoiceList?.total ?? 0;
  const kpis = deriveKpis(invoices, invoiceTotal);

  return {
    routerData,
    isRouterLoading,
    isRouterError,
    refetchRouter,
    invoices,
    invoiceTotal,
    isInvoicesLoading,
    isInvoicesError,
    refetchInvoices,
    kpis,
  };
}
