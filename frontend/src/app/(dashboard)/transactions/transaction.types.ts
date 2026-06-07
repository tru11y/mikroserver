import type { TransactionStatus } from '@/lib/transaction-status';

export type { TransactionStatus };

export type TransactionStatusFilter = TransactionStatus | 'ALL';

export type TransactionPeriod = '7j' | '30j' | '90j' | 'ALL';

export interface Transaction {
  id: string;
  reference: string;
  amountXof: number;
  status: TransactionStatus;
  externalReference?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  plan?: { name: string; slug: string } | null;
  createdAt: string;
  paidAt?: string | null;
  failedAt?: string | null;
}

export interface TransactionListResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface TransactionSummary {
  totalXof: number;
  completedCount: number;
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  refundedCount: number;
}
