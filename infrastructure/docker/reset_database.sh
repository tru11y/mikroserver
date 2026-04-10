#!/bin/bash
set -e

echo "=== RÉINITIALISATION COMPLÈTE DE LA BASE DE DONNÉES ==="

# Arrêter les containers
echo "1. Arrêt des containers..."
cd /root/mikroserver
docker-compose -f infrastructure/docker/docker-compose.prod.yml down

# Supprimer les volumes
echo "2. Suppression des volumes de données..."
docker volume rm -f docker_postgres-data 2>/dev/null || true
docker volume rm -f docker_redis-data 2>/dev/null || true

# Redémarrer
echo "3. Redémarrage des services..."
docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d

# Attendre que PostgreSQL soit prêt
echo "4. Attente du démarrage de PostgreSQL..."
for i in {1..30}; do
    if docker exec docker-postgres-1 pg_isready -U mikroserver >/dev/null 2>&1; then
        echo "PostgreSQL est prêt!"
        break
    fi
    echo "Attente ($i/30)..."
    sleep 2
done

# Générer le hash avec la version argon2 du container
echo "5. Génération du hash argon2 compatible..."
cat > /tmp/generate_hash_container.js << 'EOF'
const argon2 = require('argon2');

async function main() {
    const password = '12345678';
    console.log('Génération du hash pour:', password);
    
    const hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4
    });
    
    console.log('HASH_GENERATED:' + hash);
    
    // Vérification
    const verify = await argon2.verify(hash, password);
    console.log('Vérification:', verify);
}

main().catch(e => console.error('Erreur:', e));
EOF

# Copier dans le container API et générer le hash
docker cp /tmp/generate_hash_container.js docker-api-1:/tmp/generate_hash_container.js
HASH_OUTPUT=$(docker exec docker-api-1 node /tmp/generate_hash_container.js 2>&1)
HASH=$(echo "$HASH_OUTPUT" | grep 'HASH_GENERATED:' | cut -d':' -f2-)
echo "Hash généré: $HASH"

if [ -z "$HASH" ]; then
    echo "ERREUR: Impossible de générer le hash"
    exit 1
fi

# Créer l'utilisateur admin
echo "6. Création de l'utilisateur admin..."
cat > /tmp/create_new_admin.sql << EOF
-- Supprimer l'ancien admin s'il existe
DELETE FROM users WHERE email = 'admin@mikroserver.com';

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

SELECT '✅ Admin créé: admin@mikroserver.com / 12345678' as result;
EOF

docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/create_new_admin.sql

echo "7. Vérification..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status FROM users;"

echo "8. Test de connexion..."
cat > /tmp/test_new_login.py << 'EOF'
import requests
import json
import time

time.sleep(2)

url = "http://localhost:3000/api/v1/auth/login"
data = {
    "email": "admin@mikroserver.com",
    "password": "12345678"
}

print("Test de connexion avec nouvel utilisateur...")
try:
    resp = requests.post(url, json=data, timeout=10)
    print(f"Statut: {resp.status_code}")
    if resp.status_code == 200:
        print("✅ CONNEXION RÉUSSIE!")
        result = resp.json()
        print(f"Utilisateur: {result['data']['user']['email']}")
        print(f"Tokens obtenus: OUI")
    else:
        print("Réponse:", resp.text)
except Exception as e:
    print(f"Erreur: {e}")
EOF

python3 /tmp/test_new_login.py

echo "=== RÉINITIALISATION TERMINÉE ==="
echo "Identifiants:"
echo "  Email: admin@mikroserver.com"
echo "  Mot de passe: 12345678"
echo "  URL: http://votre-ip/dashboard"