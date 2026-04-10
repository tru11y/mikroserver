#!/bin/bash
set -e

echo "=== LAST ATTEMPT TO FIX AUTH ==="

# 1. Ensure API is running
echo "1. Checking API container..."
if ! docker ps | grep -q docker-api-1; then
    echo "   API not running, starting..."
    docker start docker-api-1
    sleep 10
fi

# 2. Test bcrypt directly
echo "2. Testing bcrypt compare..."
cat > /tmp/test_simple.js << 'EOF'
const bcrypt = require('bcrypt');

async function main() {
    console.log('=== SIMPLE BCRYPT TEST ===');
    
    const password = '12345678';
    const dbHash = '$2b$10$.nBK6EJbG5BOLjExNi.Tt.KxcJQyFSj9933yUHFX0wwV.pUqx3l22';
    
    console.log('Password:', password);
    console.log('DB Hash (first 30 chars):', dbHash.substring(0, 30) + '...');
    
    try {
        // First, verify bcrypt can load
        console.log('\n1. Testing bcrypt module...');
        console.log('   bcrypt version:', require('bcrypt/package.json').version);
        
        // Test compare
        console.log('\n2. Testing bcrypt.compare...');
        const start = Date.now();
        const valid = await bcrypt.compare(password, dbHash);
        const duration = Date.now() - start;
        
        console.log('   Result:', valid ? '✅ VALID' : '❌ INVALID');
        console.log('   Time taken:', duration + 'ms');
        
        if (valid) {
            console.log('\n🎉 Hash verification SUCCESSFUL!');
            console.log('The hash and password match correctly.');
        } else {
            console.log('\n❌ Hash verification FAILED');
            
            // Generate new hash to see if algorithm works
            console.log('\n3. Testing bcrypt.hash...');
            const newHash = await bcrypt.hash(password, 10);
            console.log('   New hash:', newHash.substring(0, 30) + '...');
            
            // Compare new hash with same password
            const newValid = await bcrypt.compare(password, newHash);
            console.log('   Verify new hash:', newValid ? '✅ Works' : '❌ Broken');
            
            if (newValid) {
                console.log('\n🔍 DIAGNOSIS: The bcrypt algorithm works, but the stored hash does not match password.');
                console.log('   Possible causes:');
                console.log('   - Wrong password (not "12345678")');
                console.log('   - Hash corrupted in database');
                console.log('   - Different bcrypt version used for generation');
                
                // Update database with working hash
                console.log('\n4. Updating database with working hash...');
                console.log('   Hash to update:', newHash);
                return newHash;
            } else {
                console.log('\n🔍 DIAGNOSIS: bcrypt is broken in this container.');
                console.log('   The module loads but compare/hash does not work.');
            }
        }
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
    }
    
    return null;
}

main().then(newHash => {
    if (newHash) {
        console.log('\nWould update database with new hash:', newHash.substring(0, 30) + '...');
        // In real script we would update DB here
    }
    process.exit(0);
}).catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
});
EOF

docker cp /tmp/test_simple.js docker-api-1:/tmp/test_simple.js
echo "Running test..."
docker exec docker-api-1 node /tmp/test_simple.js

# 3. Check if API is healthy
echo -e "\n3. Checking API health..."
if curl -s http://localhost:3000/api/v1/health/live >/dev/null; then
    echo "   ✅ API is healthy"
else
    echo "   ❌ API not responding, restarting..."
    docker restart docker-api-1
    sleep 15
    
    for i in {1..10}; do
        if curl -s http://localhost:3000/api/v1/health/live >/dev/null; then
            echo "   ✅ API is now healthy"
            break
        fi
        echo "   Waiting for API ($i/10)..."
        sleep 3
    done
fi

# 4. Final login test
echo -e "\n4. Final login test..."
RESULT=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nHTTP: %{http_code}" 2>&1)

echo "Response:"
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
    echo ""
    echo "Checking API logs for auth errors..."
    docker logs docker-api-1 --tail 20 2>&1 | grep -i "auth\|login\|bcrypt\|password\|error" | head -20
fi

echo ""
echo "=== COMPLETE ==="