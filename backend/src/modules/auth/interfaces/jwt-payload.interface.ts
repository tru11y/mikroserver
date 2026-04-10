import { UserRole } from "@prisma/client";

export interface JwtPayload {
  sub: string; // User UUID
  email: string;
  role: UserRole;
  permissionProfile?: string | null;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string; // User UUID
  familyId: string; // Token family for rotation detection
  tokenId: string; // This specific token's UUID
  iat?: number;
  exp?: number;
}
