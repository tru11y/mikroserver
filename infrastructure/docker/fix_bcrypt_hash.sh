#!/bin/bash
set -e

echo "=== FIX BCRYPT HASH ==="

# 1. Vérifier bcrypt
echo "1. Vérification bcrypt..."
docker exec docker-api-1 sh -c 'cd /app && npm list bcrypt 2>/dev/null || npm install bcrypt@^5.1.1 --legacy-peer-deps --silent' || true

# 2. Générer un vrai hash bcrypt
echo "2. Génération d'un vrai hash bcrypt..."
cat > /tmp/fix_hash.js << 'EOF'
const bcrypt = require('bcrypt');
const saltRounds = 10;

async function main() {
    console.log("Génération d'un hash bcrypt valide pour '12345678'...");
    const hash = await bcrypt.hash('12345678', saltRounds);
    console.log("REAL_BCRYPT_HASH:" + hash);
    
    // Vérifier le hash
    const valid = await bcrypt.compare('12345678', hash);
    console.log("Hash valide:", valid);
    
    if (!valid) {
        throw new Error("Hash invalide!");
    }
}

main().catch(err => {
    console.error("Erreur:", err.message);
    process.exit(1);
});
EOF

docker cp /tmp/fix_hash.js docker-api-1:/tmp/fix_hash.js
OUTPUT=$(docker exec docker-api-1 node /tmp/fix_hash.js 2>&1)
echo "$OUTPUT"

REAL_HASH=$(echo "$OUTPUT" | grep 'REAL_BCRYPT_HASH:' | cut -d':' -f2-)
if [ -z "$REAL_HASH" ]; then
    echo "❌ Impossible de générer un hash bcrypt valide"
    exit 1
fi

echo "Hash généré: ${REAL_HASH:0:60}..."

# 3. Mettre à jour l'utilisateur dans la base
echo "3. Mise à jour du hash dans la base de données..."
cat > /tmp/update_hash.sql << EOF
UPDATE users 
SET password_hash = '$REAL_HASH',
    updated_at = NOW()
WHERE email = 'admin@mikroserver.com';

SELECT '✅ Hash mis à jour!' as message;
EOF

docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/update_hash.sql

# 4. Vérifier
echo "4. Vérification..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status, length(password_hash) as hash_len, substr(password_hash, 1, 60) as hash_start FROM users;"

# 5. Redémarrer l'API
echo "5. Redémarrage de l'API..."
docker restart docker-api-1
sleep 3

# 6. Tester
echo "6. Test de connexion..."
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "=== FIN ==="