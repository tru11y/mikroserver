'use client';

import { useTransactionsPage } from './use-transactions-page';
import { TransactionsHeroSection } from './transactions-hero-section';
import { TransactionsFilters } from './transactions-filters';
import { TransactionsTableSection } from './transactions-table-section';

export default function TransactionsPage() {
  const {
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
  } = useTransactionsPage();

  return (
    <main className="space-y-4">
      <TransactionsHeroSection
        summary={summary}
        isLoading={isSummaryLoading}
        isError={isSummaryError}
      />

      <TransactionsFilters
        status={statusFilter}
        period={periodKey}
        onStatusChange={handleStatusChange}
        onPeriodChange={handlePeriodChange}
      />

      <TransactionsTableSection
        transactions={transactions}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />
    </main>
  );
}
