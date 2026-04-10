const argon2 = require('argon2');

async function test() {
    console.log('Testing with simple password...');
    
    // Générer un hash avec un mot de passe simple
    const simplePassword = 'admin';
    const hash = await argon2.hash(simplePassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4
    });
    
    console.log('Generated hash:', hash);
    console.log('Hash length:', hash.length);
    
    // Vérifier
    const result = await argon2.verify(hash, simplePassword);
    console.log('Verify with same password:', result);
    
    // Vérifier avec mauvais mot de passe
    const wrongResult = await argon2.verify(hash, 'wrong');
    console.log('Verify with wrong password:', wrongResult);
    
    // Maintenant tester avec Admin123!
    console.log('\nTesting with Admin123!...');
    const hash2 = await argon2.hash('Admin123!', {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4
    });
    
    console.log('Generated hash for Admin123!:', hash2);
    console.log('Hash length:', hash2.length);
    
    const result2 = await argon2.verify(hash2, 'Admin123!');
    console.log('Verify Admin123!:', result2);
    
    // Vérifier le hash du fichier SQL
    console.log('\nTesting SQL hash...');
    const sqlHash = '$argon2id$v=19$m=65536,t=3,p=4$peE+sgyoUquQxvEONmB66w$aPYKEkd2NQA8UtXMWW86REzIsRCpmh+zWKdZANgf62GM';
    console.log('SQL hash:', sqlHash);
    console.log('SQL hash length:', sqlHash.length);
    
    const sqlResult = await argon2.verify(sqlHash, 'Admin123!');
    console.log('Verify SQL hash with Admin123!:', sqlResult);
    
    // Vérifier avec admin (simple)
    const sqlResult2 = await argon2.verify(sqlHash, 'admin');
    console.log('Verify SQL hash with admin:', sqlResult2);
}

test().catch(e => console.error('Error:', e));