import { UserRole } from "@prisma/client";

/**
 * JWT token pair returned after login or token refresh.
 * accessExpiresIn and refreshExpiresIn are in seconds.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

/**
 * Authenticated user profile returned to the frontend.
 * Never contains passwordHash or other sensitive fields.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissionProfile: string | null;
  permissions: string[];
  lastLoginAt: Date | null;
  twoFactorEnabled: boolean;
}

/**
 * Intermediate response when 2FA is required.
 * Frontend must submit tempToken + TOTP code to /auth/2fa/verify.
 */
export interface TwoFactorPendingResponse {
  requiresTwoFactor: true;
  tempToken: string;
}

/**
 * Full login response union — either full tokens or 2FA pending.
 */
export type LoginResult =
  | { requiresTwoFactor: false; user: AuthenticatedUser; tokens: AuthTokens }
  | TwoFactorPendingResponse;
