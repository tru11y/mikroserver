import { apiClient } from './client';
import { withQuery } from './query';

export const vouchersApi = {
  list: (
    page = 1,
    limit = 20,
    options?: { status?: string; search?: string; usageState?: string },
  ) =>
    apiClient.get(
      withQuery('/vouchers', {
        page,
        limit,
        status:
          options?.status && options.status !== 'ALL'
            ? options.status
            : undefined,
        search: options?.search,
        usageState:
          options?.usageState && options.usageState !== 'ALL'
            ? options.usageState
            : undefined,
      }),
    ),
  inventorySummary: () => apiClient.get('/vouchers/inventory/summary'),
  get: (id: string) => apiClient.get(`/vouchers/${id}`),
  verify: (ticket: string, password?: string, routerId?: string) =>
    apiClient.post('/vouchers/verify', { ticket, password, routerId }),
  deleteVerified: (ticket: string, password?: string, routerId?: string) =>
    apiClient.post('/vouchers/verify/delete', { ticket, password, routerId }),
  revoke: (id: string) => apiClient.post(`/vouchers/${id}/revoke`),
  remove: (id: string) => apiClient.delete(`/vouchers/${id}`),
  bulkDelete: (voucherIds: string[]) =>
    apiClient.post('/vouchers/delete/bulk', { voucherIds }),
  redeliver: (id: string) => apiClient.post(`/vouchers/${id}/redeliver`),
  generateBulk: (data: {
    planId: string;
    routerId: string;
    count: number;
    codeLength?: number;
    ticketPrefix?: string;
    ticketType?: 'PIN' | 'USER_PASSWORD';
    numericOnly?: boolean;
    passwordLength?: number;
    passwordNumericOnly?: boolean;
  }) => apiClient.post('/vouchers/generate/bulk', data),
  downloadPdf: (
    voucherIds: string[],
    businessName?: string,
    options?: { includeQrCode?: boolean; ticketsPerPage?: number },
  ) =>
    apiClient.post(
      '/vouchers/pdf',
      {
        voucherIds,
        businessName,
        includeQrCode: options?.includeQrCode,
        ticketsPerPage: options?.ticketsPerPage,
      },
      { responseType: 'blob' },
    ),
  batchGenerate: (data: { planId: string; quantity: number; routerId?: string }) =>
    apiClient.post('/vouchers/batch', data),
  batchPrint: (voucherIds: string[]) =>
    apiClient.post('/vouchers/batch-print', { voucherIds }, { responseType: 'blob' }),
};
