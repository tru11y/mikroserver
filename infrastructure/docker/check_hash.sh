#!/bin/bash
echo "Checking user in database..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -t -c "SELECT email, LEFT(password_hash, 60) as hash_start, LENGTH(password_hash) as len FROM users WHERE email = 'admin@mikroserver.local';"

echo -e "\nGetting full hash..."
HASH=$(docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -t -A -c "SELECT password_hash FROM users WHERE email = 'admin@mikroserver.local';")
echo "Hash length: ${#HASH}"
echo "Hash: $HASH"

echo -e "\nCreating verification script..."
cat > /tmp/verify.js << 'EOF'
const argon2 = require('argon2');
const hash = process.argv[1];

async function test() {
    console.log('Testing hash...');
    console.log('Hash length:', hash.length);
    
    try {
        const result = await argon2.verify(hash, 'Admin123!');
        console.log('Verify Admin123!:', result);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
EOF

echo "Running verification..."
cd /root/mikroserver/backend && node /tmp/verify.js "$HASH"