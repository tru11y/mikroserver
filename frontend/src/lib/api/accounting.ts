import { apiClient } from './client';

export interface Invoice {
  id: string;
  number: string;
  type: string;
  status: string;
  subtotalXof: number;
  taxXof: number;
  totalXof: number;
  periodStart: string | null;
  periodEnd: string | null;
  dueDate: string | null;
  paidAt: string | null;
  lineItems: Array<{ description: string; quantity: number; unitPriceXof: number; totalXof: number }>;
  createdAt: string;
}

export const accountingApi = {
  getInvoices: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/accounting/invoices', { params }),
  getRevenueByRouter: (params?: { from?: string; to?: string }) =>
    apiClient.get('/accounting/revenue/by-router', { params }),
  getRevenueByPeriod: (params?: { months?: number }) =>
    apiClient.get('/accounting/revenue/by-period', { params }),
  generateInvoice: (data: { periodStart: string; periodEnd: string }) =>
    apiClient.post('/accounting/invoices/generate', data),
};
