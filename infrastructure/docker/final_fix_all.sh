#!/bin/bash
set -e

echo "=== FINAL FIX FOR AUTHENTICATION ==="

# 1. Arrêter l'API
echo "1. Arrêt de l'API..."
docker stop docker-api-1 2>/dev/null || true

# 2. Vérifier les dépendances dans le container
echo "2. Vérification des dépendances..."
docker exec docker-api-1 sh -c 'cd /app && npm list bcrypt 2>/dev/null | head -5' || echo "bcrypt non listé"

# 3. Installer bcrypt si nécessaire
echo "3. Installation de bcrypt..."
docker exec docker-api-1 sh -c 'cd /app && npm install bcrypt@^5.1.1 --legacy-peer-deps --silent'

# 4. Mettre à jour le seed en remote (dans le container API)
echo "4. Mise à jour du seed pour utiliser bcrypt..."
cat > /tmp/fixed_seed.js << 'EOF'
import { PrismaClient, UserRole, UserStatus, PlanStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function main() {
  console.log('Seeding database with bcrypt...');

  // --- Super Admin ---
  const adminEmail = normalizeEmail('admin@mikroserver.com');
  const adminPassword = '12345678';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);

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
    console.log('→ Updating password to bcrypt hash...');
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.update({
      where: { email: adminEmail },
      data: { passwordHash },
    });
    console.log('✓ Password updated to bcrypt');
  }

  console.log('\nSeed complete!');
  console.log(`Admin email: ${adminEmail}`);
  console.log(`Admin password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
EOF

# Copier le seed corrigé dans le container
docker cp /tmp/fixed_seed.js docker-api-1:/app/prisma/seed_fixed.js

# 5. Exécuter le seed corrigé
echo "5. Exécution du seed corrigé..."
docker exec docker-api-1 sh -c 'cd /app && npx ts-node prisma/seed_fixed.js'

# 6. Vérifier la base de données
echo "6. Vérification de la base..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status, substr(password_hash, 1, 60) as hash_start FROM users;"

# 7. Redémarrer l'API
echo "7. Redémarrage de l'API..."
docker start docker-api-1
sleep 5

# 8. Tester la connexion
echo "8. Test de connexion..."
for i in {1..10}; do
    if curl -s http://localhost:3000/api/v1/health/live >/dev/null; then
        echo "   ✅ API répond"
        break
    fi
    echo "   Attente ($i/10)..."
    sleep 2
done

echo "9. Final test..."
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nHTTP Status: %{http_code}\n" | head -c 200

echo ""
echo "=== RÉCAPITULATIF ==="
echo "Email: admin@mikroserver.com"
echo "Password: 12345678"
echo "Dashboard: http://139.84.241.27:3001"
echo "API: http://139.84.241.27:3000"
echo "=== FIN ==="