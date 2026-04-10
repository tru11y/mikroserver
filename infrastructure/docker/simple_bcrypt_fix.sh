#!/bin/bash
set -e

echo "=== SIMPLE FIX WITH BCRYPT INSTALL ==="

# 1. Installer bcrypt dans le container API existant
echo "1. Installation de bcrypt dans le container API..."
docker exec docker-api-1 sh -c 'cd /app && npm install bcrypt@^5.1.1 --legacy-peer-deps 2>&1 | tail -20'

echo "2. Vérification de bcrypt..."
docker exec docker-api-1 sh -c 'cd /app && node -e "try { const b = require(\"bcrypt\"); console.log(\"✅ Bcrypt version:\", require(\"bcrypt/package.json\").version); } catch(e) { console.log(\"❌ Erreur:\", e.message); }"'

# 3. Générer un hash bcrypt pour "12345678"
echo "3. Génération du hash bcrypt..."
cat > /tmp/gen_bcrypt.js << 'EOF'
const bcrypt = require('bcrypt');
const saltRounds = 10;

async function main() {
    const password = '12345678';
    console.log('Génération pour:', password);
    
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('HASH:' + hash);
    
    // Vérification immédiate
    const verify = await bcrypt.compare(password, hash);
    console.log('Vérification:', verify ? 'OK' : 'ÉCHEC');
}

main().catch(e => console.error('Erreur:', e));
EOF

docker cp /tmp/gen_bcrypt.js docker-api-1:/tmp/gen_bcrypt.js
OUTPUT=$(docker exec docker-api-1 node /tmp/gen_bcrypt.js 2>&1)
echo "Sortie: $OUTPUT"
HASH=$(echo "$OUTPUT" | grep 'HASH:' | cut -d':' -f2-)

if [ -z "$HASH" ]; then
    echo "ERREUR: Impossible de générer le hash"
    exit 1
fi

echo "4. Création de l'utilisateur admin avec hash: ${HASH:0:50}..."
cat > /tmp/final_admin.sql << EOF
-- Supprimer les anciens admins
DELETE FROM users WHERE email IN ('admin@mikroserver.local', 'admin@mikroserver.com');

-- Créer le nouvel admin avec hash bcrypt
INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    status,
    email_verified_at,
    permissions,
    created_at,
    updated_at
) VALUES (
    'a5242692-2cb3-41d1-8854-116b2a65e81d',
    'admin@mikroserver.com',
    '$HASH',
    'Super',
    'Admin',
    'SUPER_ADMIN',
    'ACTIVE',
    NOW(),
    '[]',
    NOW(),
    NOW()
);

SELECT '✅ Admin créé!' as result;
EOF

docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/final_admin.sql

echo "5. Vérification..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status, failed_login_attempts, locked_until FROM users;"

echo "6. Redémarrage de l'API pour s'assurer que les changements sont pris en compte..."
docker restart docker-api-1
echo "Attente de 5 secondes..."
sleep 5

echo "7. Test final de connexion..."
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nCode HTTP: %{http_code}\n" || true

echo "8. Si l'authentification échoue, vérifier le code d'authentification..."
echo "   Note: Le code a été remplacé pour utiliser bcrypt au lieu d'argon2."