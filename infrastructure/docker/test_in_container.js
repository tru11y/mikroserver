const argon2 = require('argon2');

async function test() {
    const hash = '$argon2id$v=19$m=65536,t=3,p=4$6xNefanWb3K79RT6msUtFA$gXIFbjIUXdhQdYr+0j9i51sODQDDYq0Sr7vrQQ7HhEBg';
    const password = 'password123';
    
    console.log('Testing hash verification in container...');
    console.log('Hash:', hash);
    console.log('Password:', password);
    console.log('Argon2 version:', require('argon2/package.json').version);
    
    try {
        const result = await argon2.verify(hash, password);
        console.log('Verification result:', result);
        
        // Also try to generate a new hash with same params
        console.log('\nGenerating new hash with same password...');
        const newHash = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4
        });
        console.log('New hash:', newHash);
        console.log('New hash length:', newHash.length);
        
        const verifyNew = await argon2.verify(newHash, password);
        console.log('Verify new hash:', verifyNew);
        
        // Try to verify new hash with old hash
        const crossVerify = await argon2.verify(hash, password);
        console.log('Cross verify (old hash with password):', crossVerify);
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

test().catch(console.error);