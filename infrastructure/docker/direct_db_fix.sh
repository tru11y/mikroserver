#!/bin/bash
set -e

echo "=== DIRECT DATABASE FIX ==="

# 1. Get current hash from database
echo "1. Getting current hash from database..."
CURRENT_HASH=$(docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -t -c "SELECT password_hash FROM users WHERE email = 'admin@mikroserver.com' LIMIT 1;" | tr -d '[:space:]')
echo "Current hash: ${CURRENT_HASH:0:60}..."

# 2. Check if it's a bcrypt hash
if [[ "$CURRENT_HASH" =~ ^\$2[aby]\$ ]]; then
    echo "2. Hash appears to be bcrypt format"
else
    echo "2. WARNING: Hash does not appear to be bcrypt format"
fi

# 3. Generate a new bcrypt hash for '12345678'
echo "3. Generating new bcrypt hash..."
cat > /tmp/db_test.js << 'EOF'
const bcrypt = require('bcrypt');

async function main() {
    const password = '12345678';
    
    // Test current hash
    const currentHash = process.argv[2];
    if (currentHash) {
        console.log('Testing current hash...');
        const currentValid = await bcrypt.compare(password, currentHash);
        console.log('CURRENT_VALID:' + currentValid);
        
        if (!currentValid) {
            console.log('Current hash does not match password "12345678"');
        }
    }
    
    // Generate new hash
    console.log('Generating new hash...');
    const newHash = await bcrypt.hash(password, 10);
    console.log('NEW_HASH:' + newHash);
    
    // Verify new hash
    const newValid = await bcrypt.compare(password, newHash);
    console.log('NEW_VALID:' + newValid);
}

main().catch(e => console.error('ERROR:' + e.message));
EOF

docker cp /tmp/db_test.js docker-api-1:/tmp/db_test.js
TEST_OUTPUT=$(docker exec docker-api-1 node /tmp/db_test.js "$CURRENT_HASH" 2>&1)
echo "Test output:"
echo "$TEST_OUTPUT"

# Extract results
CURRENT_VALID=$(echo "$TEST_OUTPUT" | grep 'CURRENT_VALID:' | cut -d':' -f2-)
NEW_HASH=$(echo "$TEST_OUTPUT" | grep 'NEW_HASH:' | cut -d':' -f2-)

# 4. Update database if needed
if [ "$CURRENT_VALID" = "true" ]; then
    echo "4. Current hash is valid, no update needed"
else
    echo "4. Current hash is invalid, updating database..."
    if [ -n "$NEW_HASH" ]; then
        cat > /tmp/update_db.sql << EOF
UPDATE users 
SET password_hash = '$NEW_HASH',
    updated_at = NOW()
WHERE email = 'admin@mikroserver.com';
SELECT 'Password updated' as result;
EOF
        docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/update_db.sql
        echo "✓ Database updated with new bcrypt hash"
    else
        echo "❌ Failed to generate new hash"
        exit 1
    fi
fi

# 5. Restart API
echo "5. Restarting API..."
docker restart docker-api-1
sleep 5

# 6. Test login
echo "6. Testing login..."
LOGIN_RESULT=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nHTTP: %{http_code}\n" 2>&1)

echo "Login result:"
echo "$LOGIN_RESULT"

echo ""
echo "=== DONE ==="