#!/bin/bash
echo "=== TEST BCRYPT IN CONTAINER ==="

# Get the hash from database
HASH=$(docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -t -c "SELECT password_hash FROM users WHERE email = 'admin@mikroserver.com' LIMIT 1;" | tr -d '[:space:]')
echo "Hash from DB: ${HASH:0:60}..."

# Create test script
cat > /tmp/test_hash.js << EOF
const bcrypt = require('bcrypt');

async function test() {
    console.log('Testing hash verification...');
    const hash = '$HASH';
    console.log('Hash length:', hash.length);
    
    // Test with different passwords
    const passwords = [
        '12345678',
        'password',
        'ChangeMe123!@#',
        'admin',
        'admin123',
        'Admin123',
        'Admin123!',
        'superadmin',
        'superadmin123'
    ];
    
    for (const password of passwords) {
        try {
            const valid = await bcrypt.compare(password, hash);
            console.log(\`Password "\${password}": \${valid ? '✅ VALID' : '❌ invalid'}\`);
            if (valid) {
                console.log(\`🎉 CORRECT PASSWORD FOUND: \${password}\`);
                process.exit(0);
            }
        } catch (e) {
            console.log(\`Password "\${password}": ERROR - \${e.message}\`);
        }
    }
    
    console.log('No valid password found');
    process.exit(1);
}

test().catch(e => console.error('Test error:', e.message));
EOF

# Escape the hash for sed
ESCAPED_HASH=$(echo "$HASH" | sed 's/\$/\\\$/g')
sed -i "s/\$HASH/$ESCAPED_HASH/g" /tmp/test_hash.js

# Copy to container and run
docker cp /tmp/test_hash.js docker-api-1:/tmp/test_hash.js
echo "Running test in container..."
docker exec docker-api-1 node /tmp/test_hash.js