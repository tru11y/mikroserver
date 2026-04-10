#!/bin/bash
set -e

echo "=== FULL DIAGNOSTIC ==="

# 1. Check user status
echo "1. Checking user status..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "
SELECT 
    email,
    role,
    status,
    failed_login_attempts,
    locked_until,
    last_login_at,
    deleted_at,
    length(password_hash) as hash_len
FROM users
WHERE email = 'admin@mikroserver.com';"

# 2. Get the exact hash
echo -e "\n2. Getting exact hash..."
HASH=$(docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -t -c "SELECT password_hash FROM users WHERE email = 'admin@mikroserver.com' LIMIT 1;" | tr -d '[:space:]')
echo "Hash (exact): $HASH"
echo "Hash length: ${#HASH}"

# 3. Test bcrypt in container
echo -e "\n3. Testing bcrypt.compare in API container..."
cat > /tmp/diagnostic_test.js << 'EOF'
const bcrypt = require('bcrypt');

async function test() {
    console.log('=== BCRYPT DIAGNOSTIC ===');
    
    // The hash from database
    const dbHash = process.argv[2];
    console.log('DB hash:', dbHash);
    console.log('Hash starts with:', dbHash.substring(0, 30));
    console.log('Hash length:', dbHash.length);
    
    // Check if it looks like bcrypt
    if (dbHash.startsWith('$2')) {
        console.log('✅ Hash appears to be bcrypt format');
    } else {
        console.log('❌ Hash does not look like bcrypt');
    }
    
    // Test with password '12345678'
    const password = '12345678';
    console.log('\nTesting with password:', password);
    
    try {
        const valid = await bcrypt.compare(password, dbHash);
        console.log('bcrypt.compare result:', valid);
        
        if (!valid) {
            console.log('\nTrying other common passwords...');
            const commonPasswords = [
                'password',
                'admin',
                'admin123',
                'Admin123',
                'Admin123!',
                'ChangeMe123!@#',
                'superadmin',
                'superadmin123',
                '123456',
                '123456789',
                'qwerty',
                'password123'
            ];
            
            for (const pwd of commonPasswords) {
                const testValid = await bcrypt.compare(pwd, dbHash);
                console.log(`  "${pwd}": ${testValid ? '✅ VALID!' : '❌ invalid'}`);
                if (testValid) {
                    console.log(`\n🎉 Found correct password: "${pwd}"`);
                    return;
                }
            }
            
            console.log('\n❌ No matching password found');
            
            // Generate a new hash with same password to compare
            console.log('\nGenerating new hash for comparison...');
            const newHash = await bcrypt.hash(password, 10);
            console.log('New hash:', newHash);
            console.log('New hash starts with:', newHash.substring(0, 30));
            console.log('Length comparison:', newHash.length, 'vs', dbHash.length);
            
            // Check if they're similar
            if (newHash.substring(0, 29) === dbHash.substring(0, 29)) {
                console.log('First 29 chars match!');
            } else {
                console.log('First 29 chars differ:');
                console.log('  DB:', dbHash.substring(0, 29));
                console.log('New:', newHash.substring(0, 29));
            }
        }
    } catch (error) {
        console.error('❌ Error during bcrypt.compare:', error.message);
        console.error('Stack:', error.stack);
    }
}

test().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
EOF

# Copy and run test
docker cp /tmp/diagnostic_test.js docker-api-1:/tmp/diagnostic_test.js
echo "Running diagnostic in container..."
docker exec docker-api-1 node /tmp/diagnostic_test.js "$HASH"

# 4. Check if API is using correct bcrypt
echo -e "\n4. Checking bcrypt version in API container..."
docker exec docker-api-1 sh -c 'cd /app && npm list bcrypt 2>&1 | head -5'

# 5. Try direct login with different emails
echo -e "\n5. Testing login with different email variations..."
for EMAIL in "admin@mikroserver.com" "ADMIN@MIKROSERVER.COM" " admin@mikroserver.com " "admin@mikroserver.local"; do
    echo -n "  Testing '$EMAIL': "
    OUTPUT=$(curl -X POST http://localhost:3000/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"12345678\"}" \
      -s -w " HTTP: %{http_code}" 2>/dev/null)
    
    if echo "$OUTPUT" | grep -q '"accessToken"'; then
        echo "✅ SUCCESS"
        break
    else
        echo "❌ FAILED"
    fi
done

echo -e "\n=== DIAGNOSTIC COMPLETE ==="