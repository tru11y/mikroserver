#!/bin/bash
set -e

echo "=== REBUILD API IMAGE & CREATE NEW ADMIN ==="

# Arrêter l'API
echo "1. Arrêt de l'API..."
docker stop docker-api-1 || true
docker rm docker-api-1 || true

# Rebuild l'image API
echo "2. Rebuild de l'image API..."
cd /root/mikroserver/backend
docker build -t docker-api -f Dockerfile .

echo "3. Redémarrage des services..."
cd /root/mikroserver
docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d api

echo "4. Attente du démarrage de l'API..."
for i in {1..30}; do
    if curl -s http://localhost:3000/api/v1/health/live >/dev/null 2>&1; then
        echo "API est prête!"
        break
    fi
    echo "Attente ($i/30)..."
    sleep 2
done

# Vérifier bcrypt dans le container
echo "5. Vérification de bcrypt dans le container..."
docker exec docker-api-1 sh -c 'cd /app && node -e "try { const bcrypt = require(\"bcrypt\"); console.log(\"✅ Bcrypt OK:\", require(\"bcrypt/package.json\").version); } catch(e) { console.log(\"❌ Bcrypt ERROR:\", e.message); }"'

# Générer un hash bcrypt pour "12345678"
echo "6. Génération du hash bcrypt..."
cat > /tmp/generate_bcrypt_hash.js << 'EOF'
const bcrypt = require('bcrypt');
const saltRounds = 10;

async function main() {
    const password = '12345678';
    console.log('Génération bcrypt pour:', password);
    
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('BCRYPT_HASH:' + hash);
        
        // Vérification immédiate
        const verify = await bcrypt.compare(password, hash);
        console.log('Vérification:', verify);
    } catch (e) {
        console.error('Erreur:', e.message);
        process.exit(1);
    }
}

main();
EOF

docker cp /tmp/generate_bcrypt_hash.js docker-api-1:/tmp/generate_bcrypt_hash.js
BCRYPT_OUTPUT=$(docker exec docker-api-1 node /tmp/generate_bcrypt_hash.js 2>&1)
echo "Sortie: $BCRYPT_OUTPUT"
HASH=$(echo "$BCRYPT_OUTPUT" | grep 'BCRYPT_HASH:' | cut -d':' -f2-)

if [ -z "$HASH" ]; then
    echo "ERREUR: Impossible de générer le hash bcrypt"
    exit 1
fi

echo "Hash généré: ${HASH:0:50}..."

# Créer l'utilisateur admin
echo "7. Création de l'utilisateur admin..."
cat > /tmp/create_final_admin.sql << EOF
-- Supprimer les anciens admins
DELETE FROM users WHERE email IN ('admin@mikroserver.local', 'admin@mikroserver.com');

-- Créer le nouvel admin
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

SELECT '✅ Admin créé avec succès!' as message;
EOF

docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/create_final_admin.sql

echo "8. Vérification..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status, failed_login_attempts FROM users;"

echo "9. Test de connexion..."
cat > /tmp/test_login_final.py << 'EOF'
import requests
import json
import time
import sys

time.sleep(2)

url = "http://localhost:3000/api/v1/auth/login"
data = {
    "email": "admin@mikroserver.com",
    "password": "12345678"
}

print("=== TEST FINAL DE CONNEXION ===")
print(f"URL: {url}")
print(f"Données: {json.dumps(data)}")

try:
    resp = requests.post(url, json=data, timeout=10)
    print(f"\nCode statut: {resp.status_code}")
    
    if resp.status_code == 200:
        print("✅ CONNEXION RÉUSSIE!")
        result = resp.json()
        print(f"Utilisateur: {result['data']['user']['email']}")
        print(f"Rôle: {result['data']['user']['role']}")
        print(f"Tokens obtenus: OUI")
        print(f"Access token: {result['data']['tokens']['accessToken'][:50]}...")
        sys.exit(0)
    else:
        print("❌ ÉCHEC!")
        print(f"Réponse: {resp.text}")
        sys.exit(1)
        
except Exception as e:
    print(f"Erreur de requête: {e}")
    sys.exit(1)
EOF

python3 /tmp/test_login_final.py
RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo "🎉 SUCCÈS COMPLET!"
    echo ""
    echo "=========================================="
    echo "IDENTIFIANTS DE CONNEXION:"
    echo "  Email: admin@mikroserver.com"
    echo "  Mot de passe: 12345678"
    echo "  Dashboard: http://139.84.241.27:3001"
    echo "  API: http://139.84.241.27:3000"
    echo "=========================================="
else
    echo "❌ Échec du test final."
    echo "Debug supplémentaire:"
    echo "Santé de l'API:"
    curl -s http://localhost:3000/api/v1/health/live || echo "API non accessible"
    echo ""
    echo "Logs API récents:"
    docker logs docker-api-1 --tail 20
fi