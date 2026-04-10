#!/bin/bash
set -e

echo "=== FINAL SIMPLE FIX ==="

# 1. Démarrer l'API si elle n'est pas en cours
echo "1. Vérification de l'API..."
if ! docker ps | grep -q docker-api-1; then
    echo "   Démarrage de l'API..."
    cd /root/mikroserver
    docker compose -f infrastructure/docker/docker-compose.prod.yml up -d api
    sleep 5
fi

# 2. Vérifier que l'API fonctionne
echo "2. Vérification que l'API répond..."
for i in {1..15}; do
    if curl -s http://localhost:3000/api/v1/health/live >/dev/null 2>&1; then
        echo "   ✅ API fonctionne"
        break
    fi
    echo "   Attente ($i/15)..."
    sleep 2
done

# 3. Installer bcrypt dans le container
echo "3. Installation de bcrypt dans le container API..."
docker exec docker-api-1 sh -c 'cd /app && npm install bcrypt@^5.1.1 --legacy-peer-deps 2>&1 | tail -10'

# 4. Vérifier l'installation
echo "4. Vérification de bcrypt..."
docker exec docker-api-1 sh -c 'cd /app && node -e "try { const b = require(\"bcrypt\"); console.log(\"✅ Bcrypt version:\", require(\"bcrypt/package.json\").version); } catch(e) { console.log(\"❌ Erreur:\", e.message); }"'

# 5. Générer un hash bcrypt pour "12345678"
echo "5. Génération du hash bcrypt..."
cat > /tmp/generate_hash.js << 'EOF'
const bcrypt = require('bcrypt');
const saltRounds = 10;

async function main() {
    const password = '12345678';
    console.log('Génération pour:', password);
    
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('BCRYPT_HASH:' + hash);
        
        // Vérification
        const verify = await bcrypt.compare(password, hash);
        console.log('Vérification:', verify ? 'SUCCESS' : 'FAILED');
    } catch (e) {
        console.error('Erreur:', e.message);
        process.exit(1);
    }
}

main();
EOF

docker cp /tmp/generate_hash.js docker-api-1:/tmp/generate_hash.js
BCRYPT_OUTPUT=$(docker exec docker-api-1 node /tmp/generate_hash.js 2>&1)
echo "Sortie: $BCRYPT_OUTPUT"
HASH=$(echo "$BCRYPT_OUTPUT" | grep 'BCRYPT_HASH:' | cut -d':' -f2-)

if [ -z "$HASH" ]; then
    echo "❌ ERREUR: Impossible de générer le hash bcrypt"
    exit 1
fi

echo "Hash généré: ${HASH:0:50}..."

# 6. Créer l'utilisateur admin
echo "6. Création de l'utilisateur admin..."
cat > /tmp/create_admin_final.sql << EOF
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

SELECT '✅ Admin créé!' as message;
EOF

docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/create_admin_final.sql

# 7. Vérification
echo "7. Vérification des utilisateurs..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status, failed_login_attempts, password_hash FROM users;"

# 8. Test de connexion
echo "8. Test de connexion..."
sleep 3
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nCode HTTP: %{http_code}\n" || true

echo ""
echo "=========================================="
echo "RÉCAPITULATIF:"
echo "  Email: admin@mikroserver.com"
echo "  Mot de passe: 12345678"
echo "  Dashboard: http://139.84.241.27:3001"
echo "  API: http://139.84.241.27:3000"
echo "=========================================="