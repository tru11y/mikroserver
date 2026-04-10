#!/bin/bash
set -e

echo "=== SIMPLE DATABASE RESET ==="
echo "Création de l'utilisateur: admin@mikroserver.com / 12345678"

# Générer le hash avec la version argon2 du container
echo "1. Génération du hash argon2 compatible..."
cat > /tmp/gen_hash.js << 'EOF'
const argon2 = require('argon2');

async function main() {
    try {
        const password = '12345678';
        console.log('Génération du hash pour:', password);
        
        const hash = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4
        });
        
        console.log('HASH:' + hash);
        
        // Vérification
        const verify = await argon2.verify(hash, password);
        console.log('Vérification:', verify ? 'OK' : 'ÉCHEC');
        
    } catch (error) {
        console.error('Erreur:', error.message);
        process.exit(1);
    }
}

main();
EOF

# Copier dans le container API et générer
docker cp /tmp/gen_hash.js docker-api-1:/tmp/gen_hash.js
echo "Exécution dans le container API..."
HASH_OUTPUT=$(docker exec docker-api-1 node /tmp/gen_hash.js 2>&1)
echo "Résultat: $HASH_OUTPUT"
HASH=$(echo "$HASH_OUTPUT" | grep 'HASH:' | cut -d':' -f2-)

if [ -z "$HASH" ]; then
    echo "ERREUR: Impossible de générer le hash"
    echo "Sortie complète:"
    echo "$HASH_OUTPUT"
    exit 1
fi

echo "Hash généré avec succès!"

# Supprimer l'ancien utilisateur et créer le nouveau
echo "2. Création de l'utilisateur dans la base de données..."
cat > /tmp/create_user.sql << EOF
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
    gen_random_uuid(),
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

SELECT '✅ Utilisateur créé avec succès!' as message;
EOF

docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/create_user.sql

echo "3. Vérification..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT id, email, role, status, failed_login_attempts, locked_until FROM users;"

echo "4. Test rapide de connexion..."
cat > /tmp/test_final.py << 'EOF'
import requests
import json
import time

time.sleep(2)

url = "http://localhost:3000/api/v1/auth/login"
data = {
    "email": "admin@mikroserver.com",
    "password": "12345678"
}

print("Test de connexion...")
try:
    resp = requests.post(url, json=data, timeout=10)
    print(f"Statut: {resp.status_code}")
    if resp.status_code == 200:
        print("✅ CONNEXION RÉUSSIE!")
        result = resp.json()
        print(f"Email: {result['data']['user']['email']}")
        print(f"Nom: {result['data']['user']['firstName']} {result['data']['user']['lastName']}")
        print(f"Rôle: {result['data']['user']['role']}")
    elif resp.status_code == 401:
        print("❌ Authentification refusée")
        print("Réponse:", resp.text)
    else:
        print(f"⚠️ Code inattendu: {resp.status_code}")
        print("Réponse:", resp.text[:200])
except Exception as e:
    print(f"Erreur de connexion: {e}")
EOF

python3 /tmp/test_final.py

echo "=== RÉINITIALISATION TERMINÉE ==="
echo "Identifiants:"
echo "  Email: admin@mikroserver.com"
echo "  Mot de passe: 12345678"
echo "  Dashboard: http://139.84.241.27:3001"
echo "  API: http://139.84.241.27:3000"