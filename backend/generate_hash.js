const argon2 = require('argon2');

async function main() {
    const password = 'password123'; // 12 caractères
    console.log('Generating hash for password:', password);
    
    const hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4
    });
    
    console.log('\nGenerated hash:');
    console.log(hash);
    console.log('\nHash length:', hash.length);
    
    // Vérifier
    const verify = await argon2.verify(hash, password);
    console.log('Self-verification:', verify);
    
    // Aussi vérifier avec 'admin' pour voir
    try {
        const verifyAdmin = await argon2.verify(hash, 'admin');
        console.log('Verify with "admin":', verifyAdmin);
    } catch(e) {
        console.log('Verify with "admin": error');
    }
}

main().catch(e => console.error(e));