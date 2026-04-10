#!/bin/bash
set -e

echo "=== TEST FINAL FIX ==="

# 1. Vérifier que l'API fonctionne
echo "1. Vérification API..."
curl -s http://localhost:3000/api/v1/health/live && echo "   ✅ API fonctionne" || echo "   ❌ API non accessible"

# 2. Vérifier bcrypt dans le container
echo "2. Vérification bcrypt..."
docker exec docker-api-1 sh -c 'cd /app && ls node_modules/ | grep -i bcrypt' || echo "   ❌ bcrypt non trouvé"

# 3. Vérifier l'utilisateur dans la base
echo "3. Vérification utilisateurs..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status, length(password_hash) as hash_len FROM users;"

# 4. Test de connexion direct
echo "4. Test de connexion..."
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s | jq -r '.data.tokens.accessToken[0:50] + "..." if .data else .message' 2>/dev/null || echo "   ❌ Échec de connexion"

# 5. Si échec, tester avec un hash bcrypt simple
echo "5. Test bcrypt manuel..."
cat > /tmp/test_bcrypt.js << 'EOF'
const bcrypt = require('bcrypt');
const saltRounds = 10;

async function test() {
    console.log("Test bcrypt...");
    const hash = await bcrypt.hash('12345678', saltRounds);
    console.log("Hash généré:", hash.substring(0, 60) + "...");
    
    const valid = await bcrypt.compare('12345678', hash);
    console.log("Comparaison OK:", valid);
    
    // Tester avec le hash de la base
    const dbHash = '$2b$10$Q8l9fF9gNpDvCjZc8M1v6O1Wm2nLqYtUwXyZzA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6a7b8c9d0e1f2g';
    const validDb = await bcrypt.compare('12345678', dbHash);
    console.log("Comparaison hash DB:", validDb);
}

test().catch(e => console.error("Erreur:", e.message));
EOF

docker cp /tmp/test_bcrypt.js docker-api-1:/tmp/test_bcrypt.js
docker exec docker-api-1 node /tmp/test_bcrypt.js 2>&1 | grep -v '^\s*$'