/**
 * Database Seed
 * Creates initial super admin user and default plans
 * Run: npx ts-node prisma/seed.ts
 */

import { PrismaClient, UserRole, UserStatus, PlanStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getSeedAdminConfig } = require('./admin-bootstrap.config.cjs');

async function main() {
  console.log('Seeding database with bcrypt...');

  // --- Super Admin ---
  const { email: adminEmail, password: adminPassword, firstName, lastName } =
    getSeedAdminConfig(process.env);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName,
        lastName,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
    });
    console.log(`✓ Super admin created: ${adminEmail}`);
  } else {
    console.log(`→ Super admin already exists: ${adminEmail}`);
    console.log('→ Updating password to bcrypt hash...');
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.update({
      where: { email: adminEmail },
      data: { passwordHash, firstName, lastName, passwordChangedAt: new Date() },
    });
    console.log('✓ Password updated to bcrypt');
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
    const exists = await prisma.plan.findFirst({
      where: { slug: plan.slug, ownerId: null },
    });
    if (!exists) {
      await prisma.plan.create({
        data: {
          ...plan,
          ownerId: null,
          status: PlanStatus.ACTIVE,
          metadata: {},
        } as any,
      });
    }
    console.log(`✓ Plan: ${plan.name} (${plan.priceXof} FCFA)`);
  }

  // --- SaaS Tiers ---
  const tiers = [
    {
      name: 'Découverte', slug: 'decouverte',
      description: 'Commencez gratuitement avec un routeur',
      priceXofMonthly: 0, priceXofYearly: null,
      maxRouters: 1, maxMonthlyTx: 100, maxResellers: 0,
      features: ['1 routeur', '100 tickets/mois', 'Analytics basiques', 'Support communautaire'],
      isFree: true, isActive: true, displayOrder: 1, trialDays: 0,
    },
    {
      name: 'Entrepreneur', slug: 'entrepreneur',
      description: 'Pour les opérateurs en croissance',
      priceXofMonthly: 15000, priceXofYearly: 150000,
      maxRouters: 3, maxMonthlyTx: null, maxResellers: 2,
      features: ['3 routeurs', 'Tickets illimités', 'Analytics complets', 'Notifications temps réel', '2 revendeurs', 'Support email 48h'],
      isFree: false, isActive: true, displayOrder: 2, trialDays: 14,
    },
    {
      name: 'Pro', slug: 'pro',
      description: 'Pour les opérateurs établis',
      priceXofMonthly: 40000, priceXofYearly: 400000,
      maxRouters: 10, maxMonthlyTx: null, maxResellers: 10,
      features: ['10 routeurs', 'Tickets illimités', 'API Access', 'White-label basique', '10 revendeurs', 'Support prioritaire 24h', 'Comptabilité avancée'],
      isFree: false, isActive: true, displayOrder: 3, trialDays: 14,
    },
    {
      name: 'Enterprise', slug: 'enterprise',
      description: 'Pour les grands opérateurs',
      priceXofMonthly: 100000, priceXofYearly: null,
      maxRouters: null, maxMonthlyTx: null, maxResellers: null,
      features: ['Routeurs illimités', 'White-label complet', 'SLA garanti', 'Account manager dédié', 'Formation sur site', 'Intégration personnalisée'],
      isFree: false, isActive: true, displayOrder: 4, trialDays: 30,
    },
  ];

  for (const tier of tiers) {
    await prisma.saasTier.upsert({
      where: { slug: tier.slug },
      update: {},
      create: tier as any,
    });
    console.log(`✓ SaaS tier: ${tier.name}`);
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
