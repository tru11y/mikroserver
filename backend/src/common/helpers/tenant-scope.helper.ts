import { UserRole, Prisma } from "@prisma/client";

/**
 * Returns a Prisma `where` fragment that scopes a query to the operator's
 * own resources.  SUPER_ADMIN receives an empty fragment (sees everything).
 *
 * Usage:
 *   // For models that have a direct ownerId field:
 *   const where = { ...scopeToOwner(userId, role, 'ownerId'), deletedAt: null };
 *
 *   // For models reached through a router relation:
 *   const where = { router: scopeToOwner(userId, role, 'ownerId') };
 *
 * @param userId  The requesting user's UUID (from JWT `sub`)
 * @param role    The requesting user's role (from JWT `role`)
 * @param field   The field name that holds the owner UUID (default: 'ownerId')
 */
export function scopeToOwner(
  userId: string,
  role: UserRole,
  field: string = "ownerId",
): Record<string, unknown> {
  if (role === UserRole.SUPER_ADMIN) {
    return {};
  }
  return { [field]: userId };
}

/**
 * Returns a Prisma `where` fragment for models that are linked to an owner
 * *through* a `router` relation (e.g. Voucher, Session, CustomerProfile).
 *
 * SUPER_ADMIN: empty (no restriction)
 * ADMIN:       { router: { ownerId: userId } }
 * RESELLER:    { createdById: userId }   (they only see what they created)
 */
export function scopeVoucherToOwner(
  userId: string,
  role: UserRole,
): Prisma.VoucherWhereInput {
  if (role === UserRole.SUPER_ADMIN) {
    return {};
  }
  if (role === UserRole.RESELLER) {
    return { createdById: userId };
  }
  // ADMIN and VIEWER
  return { router: { ownerId: userId } };
}

/**
 * Returns a Prisma `where` fragment for Session queries scoped to an owner.
 *
 * SUPER_ADMIN: {}
 * Others:      { router: { ownerId: userId } }
 */
export function scopeSessionToOwner(
  userId: string,
  role: UserRole,
): Prisma.SessionWhereInput {
  if (role === UserRole.SUPER_ADMIN) {
    return {};
  }
  return { router: { ownerId: userId } };
}

/**
 * Returns a Prisma `where` fragment for Transaction queries scoped to an
 * operator.  Transactions have no direct ownerId but are linked to a router
 * through their voucher.
 *
 * SUPER_ADMIN: {}
 * Others:      { voucher: { router: { ownerId: userId } } }
 */
export function scopeTransactionToOwner(
  userId: string,
  role: UserRole,
): Prisma.TransactionWhereInput {
  if (role === UserRole.SUPER_ADMIN) {
    return {};
  }
  return { voucher: { router: { ownerId: userId } } };
}
