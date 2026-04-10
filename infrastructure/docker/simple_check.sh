#!/bin/bash
set -e

echo "=== SIMPLE CHECK & FIX ==="

# 1. Check API container
echo "1. Checking API container..."
docker ps | grep docker-api-1 || {
    echo "   API container not running, starting..."
    cd /root/mikroserver && docker compose -f infrastructure/docker/docker-compose.prod.yml up -d api
    sleep 5
}

# 2. Check bcrypt
echo "2. Checking bcrypt..."
docker exec docker-api-1 sh -c 'cd /app && npm list bcrypt 2>/dev/null || npm install bcrypt@^5.1.1 --legacy-peer-deps --silent'

# 3. Generate bcrypt hash
echo "3. Generating bcrypt hash for '12345678'..."
cat > /tmp/simple_hash.js << 'EOF'
const bcrypt = require('bcrypt');
const saltRounds = 10;

async function main() {
    const hash = await bcrypt.hash('12345678', saltRounds);
    console.log('HASH:' + hash);
    const verify = await bcrypt.compare('12345678', hash);
    console.log('VERIFY:' + verify);
}

main().catch(console.error);
EOF

docker cp /tmp/simple_hash.js docker-api-1:/tmp/simple_hash.js
HASH_OUTPUT=$(docker exec docker-api-1 node /tmp/simple_hash.js 2>&1)
HASH=$(echo "$HASH_OUTPUT" | grep 'HASH:' | cut -d':' -f2-)
echo "Hash: ${HASH:0:50}..."

# 4. Create admin user
echo "4. Creating admin user..."
cat > /tmp/simple_admin.sql << EOF
DELETE FROM users WHERE email IN ('admin@mikroserver.local', 'admin@mikroserver.com');
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, email_verified_at, permissions, created_at, updated_at)
VALUES (
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
EOF

docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/simple_admin.sql

# 5. Verify
echo "5. Verifying..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status FROM users;"

# 6. Restart API
echo "6. Restarting API..."
docker restart docker-api-1
sleep 3

# 7. Test login
echo "7. Testing login..."
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nHTTP: %{http_code}\n"

echo ""
echo "=== DONE ==="