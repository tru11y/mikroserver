import axios from 'axios';
import { apiClient } from './client';

export const authApi = {
  // Login and logout go through Next.js server routes to set/clear httpOnly cookies.
  login: (email: string, password: string) =>
    axios.post('/api/auth/login', { email, password }),
  logout: () =>
    axios.post('/api/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
  requestPasswordReset: (email: string) =>
    apiClient.post('/auth/password-reset/request', { email }),
  confirmPasswordReset: (token: string, code: string, newPassword: string) =>
    apiClient.post('/auth/password-reset/confirm', {
      token,
      code,
      newPassword,
    }),
  me: () => apiClient.get('/auth/me'),
  updateProfile: (email: string) =>
    apiClient.patch('/auth/profile', { email }),
  // --- 2FA ---
  twoFaSetup: () => apiClient.post('/auth/2fa/setup', {}),
  twoFaVerifySetup: (code: string) =>
    apiClient.post('/auth/2fa/verify-setup', { code }),
  twoFaDisable: (code: string) =>
    apiClient.post('/auth/2fa/disable', { code }),
  twoFaVerify: (tempToken: string, code: string) =>
    axios.post('/api/auth/2fa-verify', { tempToken, code }),
};
