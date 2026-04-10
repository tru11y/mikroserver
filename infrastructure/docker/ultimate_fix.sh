#!/bin/bash
set -e

echo "=== ULTIMATE FIX ==="
echo "Creating fresh admin user with correct bcrypt hash"

# 1. Check if bcrypt is working
echo "1. Testing bcrypt..."
cat > /tmp/bcrypt_test.js << 'EOF'
const bcrypt = require('bcrypt');

async function test() {
    console.log("Testing bcrypt...");
    
    const password = '12345678';
    
    // Generate new hash
    const hash = await bcrypt.hash(password, 10);
    console.log('NEW_HASH:' + hash);
    
    // Verify
    const valid = await bcrypt.compare(password, hash);
    console.log('VALID:' + valid);
    
    return hash;
}

test().catch(e => console.error('ERROR:' + e.message));
EOF

docker cp /tmp/bcrypt_test.js docker-api-1:/tmp/bcrypt_test.js
OUTPUT=$(docker exec docker-api-1 node /tmp/bcrypt_test.js 2>&1)
echo "Bcrypt output: $OUTPUT"

NEW_HASH=$(echo "$OUTPUT" | grep 'NEW_HASH:' | cut -d':' -f2-)
VALID=$(echo "$OUTPUT" | grep 'VALID:' | cut -d':' -f2-)

if [ "$VALID" != "true" ] || [ -z "$NEW_HASH" ]; then
    echo "❌ Bcrypt test failed, installing bcrypt..."
    docker exec docker-api-1 sh -c 'cd /app && npm install bcrypt@^5.1.1 --legacy-peer-deps --silent'
    sleep 3
    OUTPUT=$(docker exec docker-api-1 node /tmp/bcrypt_test.js 2>&1)
    NEW_HASH=$(echo "$OUTPUT" | grep 'NEW_HASH:' | cut -d':' -f2-)
    VALID=$(echo "$OUTPUT" | grep 'VALID:' | cut -d':' -f2-)
    
    if [ "$VALID" != "true" ] || [ -z "$NEW_HASH" ]; then
        echo "❌ Still failing. Aborting."
        exit 1
    fi
fi

echo "✓ Generated hash: ${NEW_HASH:0:60}..."

# 2. Delete all existing users to start fresh
echo "2. Cleaning database..."
cat > /tmp/cleanup.sql << EOF
-- Delete all users and start fresh
DELETE FROM users;

-- Insert fresh admin with correct bcrypt hash
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
    '$NEW_HASH',
    'Super',
    'Admin',
    'SUPER_ADMIN',
    'ACTIVE',
    NOW(),
    '[]',
    NOW(),
    NOW()
);

SELECT '✅ Fresh admin created' as result;
SELECT email, role, substr(password_hash, 1, 60) as hash_start FROM users;
EOF

docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/cleanup.sql

# 3. Restart API
echo "3. Restarting API..."
docker restart docker-api-1
sleep 10

# 4. Wait for API to be ready
echo "4. Waiting for API..."
for i in {1..20}; do
    if curl -s http://localhost:3000/api/v1/health/live >/dev/null; then
        echo "✅ API is ready"
        break
    fi
    echo "  Waiting ($i/20)..."
    sleep 3
done

# 5. Test login
echo "5. Testing login..."
LOGIN_RESULT=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nHTTP: %{http_code}\n" 2>&1)

echo "Login result:"
echo "$LOGIN_RESULT"

# 6. Extract token if success
if echo "$LOGIN_RESULT" | grep -q '"accessToken"'; then
    echo ""
    echo "🎉 LOGIN SUCCESSFUL!"
    TOKEN=$(echo "$LOGIN_RESULT" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    echo "Access token: ${TOKEN:0:50}..."
    echo ""
    echo "You can now access:"
    echo "  Dashboard: http://139.84.241.27:3001"
    echo "  API: http://139.84.241.27:3000"
else
    echo ""
    echo "❌ Login still failing"
    echo "Checking logs..."
    docker logs docker-api-1 --tail 20
fi

echo ""
echo "=== FIN ==="