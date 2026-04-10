const { PrismaClient, UserRole, UserStatus } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { getRecoveryAdminConfig } = require('./admin-bootstrap.config.cjs');

const prisma = new PrismaClient();

async function listAdmins() {
  const admins = await prisma.user.findMany({
    where: {
      role: {
        in: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      lastLoginAt: true,
      deletedAt: true,
    },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
  });

  console.log(JSON.stringify({ admins }, null, 2));
}

async function recoverAdmin() {
  const { email, password, firstName, lastName } = getRecoveryAdminConfig(
    process.env,
  );

  const matchingUsers = await prisma.user.findMany({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
    },
  });

  if (matchingUsers.length > 1) {
    throw new Error(
      `Multiple admin candidates found for ${email}. Resolve duplicates before recovery.`,
    );
  }

  // IMPORTANT: backend login uses bcrypt as the canonical hashing algorithm.
  // Using bcrypt here prevents creating accounts that can never authenticate.
  const passwordHash = await bcrypt.hash(password, 10);

  let userId;
  let action;

  if (matchingUsers.length === 1) {
    const existing = matchingUsers[0];
    userId = existing.id;
    action = 'reset';

    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.id },
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          failedLoginAttempts: 0,
          lockedUntil: null,
          deletedAt: null,
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          passwordChangedAt: new Date(),
        },
      }),
      prisma.refreshToken.updateMany({
        where: {
          userId: existing.id,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      }),
    ]);
  } else {
    action = 'created';
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
      select: {
        id: true,
      },
    });
    userId = created.id;
  }

  console.log(
    JSON.stringify(
      {
        action,
        email,
        password,
        userId,
        refreshTokensRevoked: action === 'reset',
      },
      null,
      2,
    ),
  );
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--list')) {
    await listAdmins();
    return;
  }

  await recoverAdmin();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
