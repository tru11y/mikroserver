#!/bin/bash
set -e

echo "=== SIMPLE REMOTE FIX ==="

# 1. Check API container status
echo "1. Checking API container..."
if ! docker ps | grep -q docker-api-1; then
    echo "   API container not running, starting..."
    cd /root/mikroserver && docker compose -f infrastructure/docker/docker-compose.prod.yml up -d api
    sleep 10
fi

# 2. Wait for API to be ready
echo "2. Waiting for API..."
for i in {1..20}; do
    if curl -s http://localhost:3000/api/v1/health/live >/dev/null 2>&1; then
        echo "   ✅ API is ready"
        break
    fi
    echo "   Waiting ($i/20)..."
    sleep 3
done

# 3. Generate a bcrypt hash
echo "3. Generating bcrypt hash..."
cat > /tmp/gen_hash.js << 'EOF'
const bcrypt = require('bcrypt');

async function main() {
    try {
        const hash = await bcrypt.hash('12345678', 10);
        console.log('HASH:' + hash);
        
        // Verify
        const valid = await bcrypt.compare('12345678', hash);
        console.log('VERIFY:' + valid);
        
        if (!valid) {
            console.error('ERROR: Self-verification failed');
            process.exit(1);
        }
    } catch (e) {
        console.error('ERROR:' + e.message);
        process.exit(1);
    }
}

main();
EOF

docker cp /tmp/gen_hash.js docker-api-1:/tmp/gen_hash.js
HASH_OUTPUT=$(docker exec docker-api-1 node /tmp/gen_hash.js 2>&1)
echo "Hash generation output: $HASH_OUTPUT"

HASH=$(echo "$HASH_OUTPUT" | grep 'HASH:' | cut -d':' -f2-)
if [ -z "$HASH" ]; then
    echo "❌ Failed to generate hash"
    echo "Installing bcrypt..."
    docker exec docker-api-1 sh -c 'cd /app && npm install bcrypt@^5.1.1 --legacy-peer-deps --silent'
    sleep 3
    HASH_OUTPUT=$(docker exec docker-api-1 node /tmp/gen_hash.js 2>&1)
    HASH=$(echo "$HASH_OUTPUT" | grep 'HASH:' | cut -d':' -f2-)
    if [ -z "$HASH" ]; then
        echo "❌ Still failed. Aborting."
        exit 1
    fi
fi

echo "Hash generated: ${HASH:0:60}..."

# 4. Update database
echo "4. Updating database..."
cat > /tmp/update_user.sql << EOF
-- Delete existing admins
DELETE FROM users WHERE email IN ('admin@mikroserver.local', 'admin@mikroserver.com');

-- Create new admin with bcrypt hash
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

SELECT '✅ Admin created successfully!' as message;
EOF

docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/update_user.sql

# 5. Verify
echo "5. Verifying..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status, substr(password_hash, 1, 60) as hash_start FROM users;"

# 6. Restart API to ensure changes are picked up
echo "6. Restarting API..."
docker restart docker-api-1
sleep 5

# 7. Final test
echo "7. Testing login..."
for i in {1..10}; do
    if curl -s http://localhost:3000/api/v1/health/live >/dev/null; then
        echo "   API is responsive"
        break
    fi
    echo "   Waiting for API ($i/10)..."
    sleep 2
done

echo "8. Login test..."
LOGIN_RESULT=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nHTTP: %{http_code}" 2>&1)

echo "Result: $LOGIN_RESULT"

echo ""
echo "=== RÉCAPITULATIF ==="
echo "Email: admin@mikroserver.com"
echo "Password: 12345678"
echo "Dashboard: http://139.84.241.27:3001"
echo "API: http://139.84.241.27:3000"
echo "=== FIN ==="