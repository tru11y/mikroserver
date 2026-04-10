#!/bin/bash
set -e

echo "=== FINAL RESOLUTION ==="

# 1. Stop API
echo "1. Stopping API..."
docker stop docker-api-1 2>/dev/null || true

# 2. Reinstall bcrypt properly with native compilation
echo "2. Reinstalling bcrypt with native compilation..."
docker exec docker-api-1 sh -c '
    cd /app
    echo "Current bcrypt status:"
    npm list bcrypt 2>/dev/null || echo "bcrypt not in package.json"
    
    echo "Removing bcrypt..."
    rm -rf node_modules/bcrypt
    
    echo "Installing bcrypt with native compilation..."
    npm install bcrypt@^5.1.1 --legacy-peer-deps --build-from-source --no-save --silent
    
    echo "Verifying installation..."
    if node -e "try { require(\"bcrypt\"); console.log(\"bcrypt loaded OK\"); } catch(e) { console.log(\"Error:\", e.message); }"; then
        echo "✅ bcrypt installation successful"
    else
        echo "❌ bcrypt installation failed"
    fi
'

# 3. Test bcrypt directly
echo "3. Testing bcrypt directly..."
cat > /tmp/final_test.js << 'EOF'
const bcrypt = require('bcrypt');

async function main() {
    console.log('=== FINAL BCRYPT TEST ===');
    
    // Get hash from database
    const password = '12345678';
    const dbHash = '$2b$10$.nBK6EJbG5BOLjExNi.Tt.KxcJQyFSj9933yUHFX0wwV.pUqx3l22';
    
    console.log('Password:', password);
    console.log('DB Hash:', dbHash);
    console.log('Hash starts with:', dbHash.substring(0, 30));
    
    try {
        console.log('\nTesting bcrypt.compare...');
        const valid = await bcrypt.compare(password, dbHash);
        console.log('Result:', valid);
        
        if (valid) {
            console.log('✅ Hash verification SUCCESSFUL!');
            console.log('The problem is NOT the hash/password combination.');
        } else {
            console.log('❌ Hash verification FAILED');
            console.log('Generating new hash for same password to compare...');
            const newHash = await bcrypt.hash(password, 10);
            console.log('New hash:', newHash);
            console.log('Compare new hash with same password:', await bcrypt.compare(password, newHash));
            
            // Check if it's a salt/version issue
            console.log('\nHash analysis:');
            console.log('DB hash prefix:', dbHash.substring(0, 7));
            console.log('New hash prefix:', newHash.substring(0, 7));
        }
    } catch (error) {
        console.error('❌ Error during bcrypt.compare:', error.message);
        console.error('Stack:', error.stack);
    }
}

main().catch(e => console.error('Fatal:', e));
EOF

docker cp /tmp/final_test.js docker-api-1:/tmp/final_test.js
docker exec docker-api-1 node /tmp/final_test.js

# 4. Start API
echo "4. Starting API..."
docker start docker-api-1
sleep 10

# 5. Wait for API
echo "5. Waiting for API..."
for i in {1..15}; do
    if curl -s http://localhost:3000/api/v1/health/live >/dev/null; then
        echo "✅ API is responsive"
        break
    fi
    echo "   Waiting ($i/15)..."
    sleep 2
done

# 6. Final login test
echo "6. Final login test..."
LOGIN_RESULT=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nHTTP: %{http_code}\n" 2>&1)

echo "Result:"
echo "$LOGIN_RESULT"

if echo "$LOGIN_RESULT" | grep -q '"accessToken"'; then
    echo ""
    echo "🎉 LOGIN SUCCESSFUL!"
    echo ""
    echo "✅ Authentication problem RESOLVED!"
    echo ""
    echo "Credentials:"
    echo "  Email: admin@mikroserver.com"
    echo "  Password: 12345678"
    echo "  Dashboard: http://139.84.241.27:3001"
    echo "  API: http://139.84.241.27:3000"
else
    echo ""
    echo "❌ Login still failing"
    echo ""
    echo "Debugging steps:"
    echo "1. Check API logs for auth errors"
    echo "2. Verify user exists in database"
    echo "3. Check bcrypt version compatibility"
    
    echo ""
    echo "Checking API logs..."
    docker logs docker-api-1 --tail 30 2>&1 | grep -A5 -B5 -i "auth\|login\|bcrypt\|password"
fi

echo ""
echo "=== COMPLETE ==="