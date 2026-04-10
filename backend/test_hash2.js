const argon2 = require('argon2');

async function test() {
    // Générer un nouveau hash avec Admin123!
    console.log('Generating new hash for Admin123!...');
    const newHash = await argon2.hash('Admin123!', {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4
    });
    console.log('New hash:', newHash);
    
    // Vérifier le nouveau hash
    const verifyResult = await argon2.verify(newHash, 'Admin123!');
    console.log('Verify new hash with Admin123!:', verifyResult);
    
    // Vérifier l'ancien hash avec différents mots de passe
    const oldHash = '$argon2id$v=19$m=65536,t=3,p=4$GEnKyJ2jJmpSAGvKwKB7pQ$d7llqt9MY8BSTdSvgHuGgg0PdfD37IX61bXudrdaE95Q';
    console.log('\nTesting old hash with various passwords:');
    
    const testPasswords = ['Admin123!', 'admin', 'admin123', 'Admin123', 'Admin123!!', 'Admin123! ', ' Admin123!'];
    
    for (const pwd of testPasswords) {
        try {
            const result = await argon2.verify(oldHash, pwd);
            console.log(`  "${pwd}": ${result}`);
        } catch (e) {
            console.log(`  "${pwd}": ERROR - ${e.message}`);
        }
    }
}

test();