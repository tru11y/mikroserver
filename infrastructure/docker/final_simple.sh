#!/bin/bash
set -e

echo "=== FINAL SIMPLE FIX ==="

# 1. Install bcrypt if not present
echo "1. Ensuring bcrypt is installed..."
docker exec docker-api-1 sh -c 'cd /app && npm list bcrypt 2>/dev/null | head -2 || npm install bcrypt@^5.1.1 --legacy-peer-deps --silent'

# 2. Generate bcrypt hash for '12345678'
echo "2. Generating bcrypt hash..."
cat > /tmp/generate_hash.js << 'EOF'
const bcrypt = require('bcrypt');

async function main() {
    try {
        const password = '12345678';
        const hash = await bcrypt.hash(password, 10);
        console.log('HASH:' + hash);
        
        // Verify
        const valid = await bcrypt.compare(password, hash);
        if (!valid) {
            console.error('ERROR: Self-verification failed');
            process.exit(1);
        }
        console.log('OK: Hash generated and verified');
    } catch (e) {
        console.error('ERROR:' + e.message);
        process.exit(1);
    }
}

main();
EOF

docker cp /tmp/generate_hash.js docker-api-1:/tmp/generate_hash.js
HASH_OUTPUT=$(docker exec docker-api-1 node /tmp/generate_hash.js 2>&1)
echo "Hash output: $HASH_OUTPUT"

HASH=$(echo "$HASH_OUTPUT" | grep 'HASH:' | cut -d':' -f2-)
if [ -z "$HASH" ]; then
    echo "❌ Failed to generate hash"
    exit 1
fi

echo "✓ Hash generated: ${HASH:0:60}..."

# 3. Update database
echo "3. Updating database..."
cat > /tmp/update_final.sql << EOF
-- Ensure user exists with correct hash
DELETE FROM users WHERE email = 'admin@mikroserver.com';

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
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    updated_at = NOW();

SELECT '✅ User created/updated' as result;
EOF

docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/update_final.sql

# 4. Restart API
echo "4. Restarting API..."
docker restart docker-api-1
sleep 10

# 5. Test
echo "5. Testing..."
for i in {1..10}; do
    if curl -s http://localhost:3000/api/v1/health/live >/dev/null; then
        echo "   ✅ API responsive"
        break
    fi
    echo "   Waiting for API ($i/10)..."
    sleep 3
done

# 6. Login test
echo "6. Login test..."
LOGIN_OUTPUT=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nHTTP: %{http_code}\n" 2>&1)

echo "Result:"
echo "$LOGIN_OUTPUT"

if echo "$LOGIN_OUTPUT" | grep -q '"accessToken"'; then
    echo ""
    echo "🎉 LOGIN SUCCESSFUL!"
    echo ""
    echo "Credentials:"
    echo "  Email: admin@mikroserver.com"
    echo "  Password: 12345678"
    echo "  Dashboard: http://139.84.241.27:3001"
    echo "  API: http://139.84.241.27:3000"
else
    echo ""
    echo "❌ Login still failing"
    echo "Checking API logs..."
    docker logs docker-api-1 --tail 20
fi

echo ""
echo "=== DONE ==="