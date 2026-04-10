#!/bin/bash
set -e

echo "=== FIXING BCRYPT BUILD ==="

# 1. Install build dependencies in API container
echo "1. Installing build dependencies..."
docker exec docker-api-1 sh -c '
    apk add --no-cache python3 make g++ node-gyp 2>&1 | tail -20
    echo "Build tools installed"
'

# 2. Install bcrypt with pre-built binaries
echo "2. Installing bcrypt with pre-built binaries..."
docker exec docker-api-1 sh -c '
    cd /app
    echo "Removing bcrypt..."
    rm -rf node_modules/bcrypt 2>/dev/null || true
    
    echo "Installing bcrypt with --build-from-source..."
    npm install bcrypt@^5.1.1 --legacy-peer-deps --build-from-source --no-save 2>&1 | tail -30
    
    echo "Verifying installation..."
    ls -la node_modules/bcrypt/
    ls -la node_modules/bcrypt/lib/binding/ 2>/dev/null || echo "No binding directory"
    
    if node -e "try { console.log(\"bcrypt version:\", require(\"bcrypt/package.json\").version); } catch(e) { console.log(\"Error:\", e.message); }"; then
        echo "✅ bcrypt package.json found"
    else
        echo "❌ bcrypt package.json not found"
    fi
'

# 3. Test bcrypt
echo "3. Testing bcrypt..."
cat > /tmp/test_bcrypt_final.js << 'EOF'
console.log('=== BCRYPT FINAL TEST ===');
console.log('Node version:', process.version);

try {
    // Try to require bcrypt
    const bcrypt = require('bcrypt');
    console.log('✅ bcrypt loaded successfully');
    console.log('Version:', require('bcrypt/package.json').version);
    
    // Test basic functionality
    const testPassword = 'test123';
    const hash = bcrypt.hashSync(testPassword, 10);
    console.log('Generated hash:', hash.substring(0, 30) + '...');
    
    const valid = bcrypt.compareSync(testPassword, hash);
    console.log('Self-test:', valid ? '✅ PASS' : '❌ FAIL');
    
    // Test with database hash
    const dbHash = '$2b$10$.nBK6EJbG5BOLjExNi.Tt.KxcJQyFSj9933yUHFX0wwV.pUqx3l22';
    console.log('\nTesting database hash...');
    
    const testPasswords = [
        '12345678',
        'password',
        'admin123',
        'Admin123',
        'Admin123!',
        'ChangeMe123!@#',
        'superadmin',
        'mikroserver',
        'admin',
        'Admin',
        'ADMIN'
    ];
    
    for (const pwd of testPasswords) {
        const result = bcrypt.compareSync(pwd, dbHash);
        console.log(`  "${pwd}": ${result ? '✅ MATCH!' : '❌ no match'}`);
        if (result) {
            console.log(`\n🎉 PASSWORD FOUND: "${pwd}"`);
            process.exit(0);
        }
    }
    
    console.log('\n❌ No password matched');
    console.log('\nPossible issues:');
    console.log('1. Wrong password (not in list)');
    console.log('2. Hash corrupted');
    console.log('3. bcrypt version mismatch');
    
} catch (error) {
    console.error('❌ ERROR loading bcrypt:', error.message);
    console.error('Stack:', error.stack);
    
    // Try to debug what's in node_modules
    console.log('\nDebug info:');
    const fs = require('fs');
    const path = require('path');
    
    try {
        const bcryptPath = path.join(__dirname, '../../node_modules/bcrypt');
        console.log('bcrypt path:', bcryptPath);
        console.log('Exists:', fs.existsSync(bcryptPath));
        
        if (fs.existsSync(bcryptPath)) {
            const files = fs.readdirSync(bcryptPath);
            console.log('Files in bcrypt:', files);
            
            const libPath = path.join(bcryptPath, 'lib');
            if (fs.existsSync(libPath)) {
                const libFiles = fs.readdirSync(libPath);
                console.log('Files in lib:', libFiles);
            }
        }
    } catch (e) {
        console.log('Cannot inspect bcrypt dir:', e.message);
    }
    
    process.exit(1);
}
EOF

docker cp /tmp/test_bcrypt_final.js docker-api-1:/tmp/test_bcrypt_final.js
docker exec docker-api-1 node /tmp/test_bcrypt_final.js

# 4. Restart API
echo -e "\n4. Restarting API..."
docker restart docker-api-1
sleep 10

# 5. Test API and login
echo -e "\n5. Testing API and login..."
if curl -s http://localhost:3000/api/v1/health/live >/dev/null; then
    echo "✅ API is responsive"
    
    echo -e "\n6. Testing login..."
    RESULT=$(curl -X POST http://localhost:3000/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
      -s -w "\nHTTP: %{http_code}" 2>&1)
    
    echo "Login result:"
    echo "$RESULT"
    
    if echo "$RESULT" | grep -q '"accessToken"'; then
        echo ""
        echo "🎉🎉🎉 LOGIN SUCCESSFUL! 🎉🎉🎉"
        echo ""
        echo "✅ Authentication FIXED!"
        echo ""
        echo "You can now access:"
        echo "  Dashboard: http://139.84.241.27:3001"
        echo "  API: http://139.84.241.27:3000"
        echo "  Credentials: admin@mikroserver.com / 12345678"
    else
        echo ""
        echo "❌ Login still failing"
        echo "Checking API logs for auth errors..."
        docker logs docker-api-1 --tail 15 2>&1 | grep -i "auth\|login\|password\|bcrypt\|error" | head -20
    fi
else
    echo "❌ API not responding after restart"
    echo "Checking logs..."
    docker logs docker-api-1 --tail 20
fi

echo ""
echo "=== COMPLETE ==="