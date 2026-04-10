#!/bin/bash
echo "=== DEBUG HASH COMPARISON ==="

# Get hash from database
echo -e "\n1. Hash from database:"
DB_HASH=$(docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -t -A -c "SELECT password_hash FROM users WHERE email = 'admin@mikroserver.local';")
echo "DB Hash: $DB_HASH"
echo "DB Hash length: ${#DB_HASH}"
echo "DB Hash first 50 chars: ${DB_HASH:0:50}"

# Expected hash from our generation
echo -e "\n2. Expected hash (generated locally):"
EXPECTED_HASH='$argon2id$v=19$m=65536,t=3,p=4$6xNefanWb3K79RT6msUtFA$gXIFbjIUXdhQdYr+0j9i51sODQDDYq0Sr7vrQQ7HhEBg'
echo "Expected Hash: $EXPECTED_HASH"
echo "Expected Hash length: ${#EXPECTED_HASH}"
echo "Expected Hash first 50 chars: ${EXPECTED_HASH:0:50}"

# Compare
echo -e "\n3. Comparison:"
if [ "$DB_HASH" = "$EXPECTED_HASH" ]; then
    echo "✅ Hashes are IDENTICAL"
else
    echo "❌ Hashes are DIFFERENT"
    echo "Diff positions:"
    for ((i=0; i<${#DB_HASH}; i++)); do
        if [ "${DB_HASH:$i:1}" != "${EXPECTED_HASH:$i:1}" ]; then
            echo "  Position $i: DB='${DB_HASH:$i:1}' (${DB_HASH:$i:1}) vs Expected='${EXPECTED_HASH:$i:1}' (${EXPECTED_HASH:$i:1})"
            # Show context
            echo "  Context DB: ...${DB_HASH:$((i-5)):20}..."
            echo "  Context Exp: ...${EXPECTED_HASH:$((i-5)):20}..."
            break
        fi
    done
fi

# Check user status
echo -e "\n4. User status in database:"
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status, failed_login_attempts, locked_until, last_login_at, password_changed_at FROM users WHERE email = 'admin@mikroserver.local';"

# Check argon2 version in container
echo -e "\n5. Checking argon2 in API container:"
docker exec docker-api-1 sh -c "cd /app && node -e \"const argon2 = require('argon2'); console.log('Argon2 version:', require('argon2/package.json').version);\" 2>&1" || echo "Failed to check argon2"

# Test hash verification directly
echo -e "\n6. Direct hash verification test:"
cat > /tmp/test_verify.js << 'EOF'
const argon2 = require('argon2');
const dbHash = process.argv[1];
const expectedHash = process.argv[2];

async function test() {
    console.log('DB Hash:', dbHash);
    console.log('Expected Hash:', expectedHash);
    console.log('Equal strings:', dbHash === expectedHash);
    
    try {
        const result = await argon2.verify(dbHash, 'password123');
        console.log('Verify DB hash with "password123":', result);
    } catch(e) {
        console.log('Error verifying DB hash:', e.message);
    }
    
    try {
        const result2 = await argon2.verify(expectedHash, 'password123');
        console.log('Verify expected hash with "password123":', result2);
    } catch(e) {
        console.log('Error verifying expected hash:', e.message);
    }
}

test();
EOF

cd /root/mikroserver/backend && node /tmp/test_verify.js "$DB_HASH" "$EXPECTED_HASH" 2>&1