# PowerShell script to test bcrypt locally
Write-Host "=== TEST BCRYPT LOCALLY ===" -ForegroundColor Cyan

# Check if node modules are available
$backendPath = "..\..\backend"
if (Test-Path "$backendPath\node_modules") {
    Write-Host "Node modules found" -ForegroundColor Green
} else {
    Write-Host "Node modules not found, installing..." -ForegroundColor Yellow
}

# Create a test script
$testScript = @"
const bcrypt = require('bcrypt');

async function test() {
    console.log('Testing bcrypt...');
    
    // Test 1: Generate a bcrypt hash
    const password = '12345678';
    const hash = await bcrypt.hash(password, 10);
    console.log('Generated hash:', hash.substring(0, 60) + '...');
    
    // Test 2: Verify the hash
    const valid = await bcrypt.compare(password, hash);
    console.log('Self-verification:', valid);
    
    // Test 3: Test with actual DB hash from logs
    const dbHash = '\$2b\$10\$N9qo8uLOickgx2ZMRZoMyeIjZggG3cG6ZBJX7P2qVv5v5v5v5v5v5v5v';
    console.log('\nDB hash:', dbHash.substring(0, 60) + '...');
    
    // Check if DB hash looks like bcrypt
    if (dbHash.startsWith('\$2')) {
        console.log('DB hash appears to be bcrypt format');
        const dbValid = await bcrypt.compare(password, dbHash);
        console.log('DB hash verification:', dbValid);
        
        if (!dbValid) {
            console.log('ERROR: Hash in DB does not match password "12345678"');
            console.log('Possible issues:');
            console.log('1. Password is different');
            console.log('2. Hash was double-hashed');
            console.log('3. Hash is corrupted');
        }
    } else {
        console.log('DB hash does not appear to be bcrypt format');
    }
}

test().catch(console.error);
"@

# Write test script
$testScript | Out-File -FilePath "$PWD\test_bcrypt_temp.js" -Encoding UTF8

# Run the test
Write-Host "`nRunning test..." -ForegroundColor Cyan
try {
    node "$PWD\test_bcrypt_temp.js"
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Clean up
Remove-Item "$PWD\test_bcrypt_temp.js" -ErrorAction SilentlyContinue

Write-Host "`n=== CHECKING SEED FILE ===" -ForegroundColor Cyan
if (Test-Path "..\..\backend\prisma\seed.ts") {
    $seedContent = Get-Content "..\..\backend\prisma\seed.ts" -Raw
    if ($seedContent -match "argon2") {
        Write-Host "WARNING: seed.ts still references argon2!" -ForegroundColor Red
    } else {
        Write-Host "seed.ts appears to use bcrypt" -ForegroundColor Green
    }
    
    if ($seedContent -match "import.*bcrypt") {
        Write-Host "bcrypt import found" -ForegroundColor Green
    } else {
        Write-Host "bcrypt import NOT found" -ForegroundColor Red
    }
}

Write-Host "`n=== DONE ===" -ForegroundColor Cyan