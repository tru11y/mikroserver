/**
 * Database Seed
 * Creates initial super admin user and default plans
 * Run: npx ts-node prisma/seed.ts
 */

import { PrismaClient, UserRole, UserStatus, PlanStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // --- Super Admin ---
  const adminEmail = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@mikroserver.ci';
  const adminPassword = process.env['SEED_ADMIN_PASSWORD'] ?? 'ChangeMe123!@#';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`✓ Super admin created: ${adminEmail}`);
  } else {
    console.log(`→ Super admin already exists: ${adminEmail}`);
  }

  // --- Default Plans ---
  const plans = [
    {
      name: '30 Minutes',
      slug: '30-minutes',
      description: 'Forfait découverte 30 minutes',
      durationMinutes: 30,
      priceXof: 200,
      downloadKbps: 2048,
      uploadKbps: 512,
      displayOrder: 1,
    },
    {
      name: '1 Heure',
      slug: '1-heure',
      description: 'Navigation 1 heure',
      durationMinutes: 60,
      priceXof: 300,
      downloadKbps: 4096,
      uploadKbps: 1024,
      displayOrder: 2,
      isPopular: true,
    },
    {
      name: '3 Heures',
      slug: '3-heures',
      description: 'Forfait demi-journée',
      durationMinutes: 180,
      priceXof: 700,
      downloadKbps: 4096,
      uploadKbps: 1024,
      displayOrder: 3,
    },
    {
      name: '24 Heures',
      slug: '24-heures',
      description: 'Accès complet 24h',
      durationMinutes: 1440,
      priceXof: 2000,
      displayOrder: 4,
    },
    {
      name: '7 Jours',
      slug: '7-jours',
      description: 'Forfait semaine',
      durationMinutes: 10080,
      priceXof: 10000,
      displayOrder: 5,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {},
      create: {
        ...plan,
        status: PlanStatus.ACTIVE,
        metadata: {}
      } as any,
    });
    console.log(`✓ Plan: ${plan.name} (${plan.priceXof} FCFA)`);
  }

  console.log('\nSeed complete!');
  console.log(`Admin email: ${adminEmail}`);
  console.log(`Admin password: ${adminPassword}`);
  console.log('⚠️  CHANGE THE DEFAULT PASSWORD IMMEDIATELY IN PRODUCTION!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
