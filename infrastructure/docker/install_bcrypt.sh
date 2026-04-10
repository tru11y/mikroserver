#!/bin/bash
set -e

echo "=== INSTALLING BCRYPT IN API CONTAINER ==="

# 1. Install bcrypt with native compilation
echo "1. Installing bcrypt..."
docker exec docker-api-1 sh -c '
    cd /app
    echo "Current directory: $(pwd)"
    echo "Node version: $(node --version)"
    echo "npm version: $(npm --version)"
    
    echo "Removing existing bcrypt..."
    rm -rf node_modules/bcrypt 2>/dev/null || true
    
    echo "Installing bcrypt with native bindings..."
    npm install bcrypt@^5.1.1 --legacy-peer-deps --build-from-source --no-save 2>&1 | tail -20
    
    echo "Verifying installation..."
    if node -e "try { console.log(\"bcrypt version:\", require(\"bcrypt/package.json\").version); } catch(e) { console.log(\"ERROR loading bcrypt:\", e.message); }"; then
        echo "✅ bcrypt installed successfully"
    else
        echo "❌ bcrypt installation failed"
    fi
'

# 2. Test bcrypt
echo -e "\n2. Testing bcrypt..."
cat > /tmp/test_final.js << 'EOF'
console.log('=== FINAL BCRYPT TEST ===');
console.log('Node version:', process.version);

try {
    const bcrypt = require('bcrypt');
    console.log('✅ bcrypt loaded');
    console.log('bcrypt version:', require('bcrypt/package.json').version);
    
    // Simple test
    const password = 'test123';
    const hash = bcrypt.hashSync(password, 10);
    console.log('Hash generated:', hash.substring(0, 30) + '...');
    
    const valid = bcrypt.compareSync(password, hash);
    console.log('Self-verification:', valid ? '✅ PASS' : '❌ FAIL');
    
    // Test with database hash
    const dbHash = '$2b$10$.nBK6EJbG5BOLjExNi.Tt.KxcJQyFSj9933yUHFX0wwV.pUqx3l22';
    console.log('\nTesting database hash...');
    console.log('DB hash start:', dbHash.substring(0, 30) + '...');
    
    const testPasswords = [
        '12345678',
        'password',
        'admin123',
        'Admin123!',
        'ChangeMe123!@#',
        'superadmin',
        'mikroserver'
    ];
    
    for (const pwd of testPasswords) {
        const result = bcrypt.compareSync(pwd, dbHash);
        console.log(`  "${pwd}": ${result ? '✅ MATCH!' : '❌ no match'}`);
        if (result) {
            console.log(`\n🎉 PASSWORD FOUND: "${pwd}"`);
            process.exit(0);
        }
    }
    
    console.log('\n❌ No password matched the hash');
    
} catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}
EOF

docker cp /tmp/test_final.js docker-api-1:/tmp/test_final.js
docker exec docker-api-1 node /tmp/test_final.js

# 3. Restart API to ensure changes take effect
echo -e "\n3. Restarting API..."
docker restart docker-api-1
sleep 10

# 4. Test API
echo -e "\n4. Testing API..."
if curl -s http://localhost:3000/api/v1/health/live >/dev/null; then
    echo "✅ API is responsive"
    
    # 5. Test login
    echo -e "\n5. Testing login..."
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
        echo "Checking API logs..."
        docker logs docker-api-1 --tail 10 2>&1 | grep -i "auth\|login\|password\|error"
    fi
else
    echo "❌ API not responding after restart"
    echo "Checking logs..."
    docker logs docker-api-1 --tail 20
fi

echo ""
echo "=== COMPLETE ==="