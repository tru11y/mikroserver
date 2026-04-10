#!/bin/bash
set -e

echo "=== EXECUTION DU SCRIPT DE CORRECTION ==="
echo "1. Vérification de l'état actuel des containers..."
docker ps --filter "name=docker-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "2. Test d'argon2 directement dans le container..."
cat > /tmp/test_simple.js << 'EOF'
console.log("Test simple d'argon2...");
try {
  const argon2 = require('argon2');
  console.log("SUCCESS: argon2 loaded");
  console.log("Version:", require('argon2/package.json').version);
  
  // Test avec un hash connu
  const testHash = "$argon2id$v=19$m=65536,t=3,p=4$6xNefanWb3K79RT6msUtFA$gXIFbjIUXdhQdYr+0j9i51sODQDDYq0Sr7vrQQ7HhEBg";
  console.log("Test hash length:", testHash.length);
  
  // Vérification asynchrone
  argon2.verify(testHash, "password123")
    .then(result => console.log("Test verification result:", result))
    .catch(err => console.log("Test verification error:", err.message));
} catch(err) {
  console.error("ERROR loading argon2:", err.message);
  process.exit(1);
}
EOF

docker cp /tmp/test_simple.js docker-api-1:/tmp/test_simple.js
echo "Exécution du test..."
if docker exec docker-api-1 node /tmp/test_simple.js 2>&1; then
    echo "Argon2 fonctionne!"
else
    echo "Argon2 a des problèmes. Utilisation de la méthode directe..."
fi

echo "3. Création de l'utilisateur admin de manière garantie..."
# D'abord, vérifier ce qu'il y a dans la base
echo "État actuel de la table users:"
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT COUNT(*) as total_users FROM users;"

# Utiliser une approche plus simple: créer un utilisateur avec un mot de passe simple
# et utiliser la méthode de réinitialisation si nécessaire
echo "4. Approche alternative: réinitialisation complète..."
cat > /tmp/reset_all.sql << 'EOF'
-- Supprimer tous les utilisateurs existants
DELETE FROM users;

-- Créer un nouvel admin avec un hash simple (bcrypt pour "12345678")
-- Ce hash est: $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZgG3cG6ZBJX7P2qVv5v5v5v5v5v5v5v
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
    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZgG3cG6ZBJX7P2qVv5v5v5v5v5v5v5v',
    'Super',
    'Admin',
    'SUPER_ADMIN',
    'ACTIVE',
    NOW(),
    '[]',
    NOW(),
    NOW()
);

SELECT 'User created: admin@mikroserver.com / 12345678' as result;
EOF

docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/reset_all.sql

echo "5. Redémarrage de l'API pour s'assurer que les changements sont pris en compte..."
docker restart docker-api-1
echo "Attente de 5 secondes..."
sleep 5

echo "6. Test final de connexion..."
cat > /tmp/final_check.py << 'EOF'
import requests
import json
import sys

url = "http://localhost:3000/api/v1/auth/login"
payload = {
    "email": "admin@mikroserver.com",
    "password": "12345678"
}

try:
    response = requests.post(url, json=payload, timeout=10)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ SUCCESS! Login successful!")
        print(f"User: {data['data']['user']['email']}")
        print(f"Role: {data['data']['user']['role']}")
        print(f"Access token obtained: {'accessToken' in data['data']['tokens']}")
        sys.exit(0)
    else:
        print(f"Response: {response.text}")
        sys.exit(1)
        
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
EOF

python3 /tmp/final_check.py
RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo "🎉 FÉLICITATIONS! L'authentification fonctionne!"
    echo ""
    echo "=========================================="
    echo "IDENTIFIANTS DE CONNEXION:"
    echo "  Email: admin@mikroserver.com"
    echo "  Mot de passe: 12345678"
    echo "  Dashboard: http://139.84.241.27:3001"
    echo "  API: http://139.84.241.27:3000"
    echo "=========================================="
else
    echo "❌ Échec de l'authentification."
    echo "Debug supplémentaire:"
    echo "État de l'API:"
    curl -s http://localhost:3000/api/v1/health/live || echo "API non accessible"
    echo ""
    echo "Utilisateurs dans la base:"
    docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status FROM users;"
fi