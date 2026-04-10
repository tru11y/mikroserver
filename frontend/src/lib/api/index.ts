import { auditApi } from './audit';
import { authApi } from './auth';
import { metricsApi } from './metrics';
import { notificationsApi } from './notifications';
import { plansApi } from './plans';
import { routersApi } from './routers';
import { sessionsApi } from './sessions';
import { settingsApi } from './settings';
import { transactionsApi } from './transactions';
import { usersApi } from './users';
import { vouchersApi } from './vouchers';
import { apiKeysApi } from './api-keys';

export { unwrap, apiError } from './client';

export const api = {
  auth: authApi,
  audit: auditApi,
  metrics: metricsApi,
  notifications: notificationsApi,
  plans: plansApi,
  transactions: transactionsApi,
  routers: routersApi,
  settings: settingsApi,
  vouchers: vouchersApi,
  users: usersApi,
  sessions: sessionsApi,
  apiKeys: apiKeysApi,
};
