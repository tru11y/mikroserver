const bcrypt = require('bcrypt');
const argon2 = require('argon2');

async function test() {
    console.log("=== TEST BCRYPT vs ARGON2 ===");
    
    const password = "12345678";
    
    // 1. Générer un hash bcrypt
    console.log("\n1. Génération bcrypt...");
    const bcryptHash = await bcrypt.hash(password, 10);
    console.log("Bcrypt hash:", bcryptHash);
    console.log("Début:", bcryptHash.substring(0, 60));
    
    // 2. Vérifier bcrypt
    const bcryptValid = await bcrypt.compare(password, bcryptHash);
    console.log("Bcrypt vérification:", bcryptValid);
    
    // 3. Générer un hash argon2
    console.log("\n2. Génération argon2...");
    const argon2Hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
    });
    console.log("Argon2 hash:", argon2Hash);
    console.log("Début:", argon2Hash.substring(0, 60));
    
    // 4. Vérifier argon2
    const argon2Valid = await argon2.verify(argon2Hash, password);
    console.log("Argon2 vérification:", argon2Valid);
    
    // 5. Essayer bcrypt.compare sur hash argon2 (c'est ce qui échoue)
    console.log("\n3. Test d'incompatibilité:");
    console.log("Bcrypt.compare sur hash argon2:");
    try {
        const wrongCompare = await bcrypt.compare(password, argon2Hash);
        console.log("Résultat:", wrongCompare, "(devrait être false)");
    } catch (e) {
        console.log("Erreur:", e.message);
    }
    
    // 6. Hash actuel de la base (extrait des logs)
    const dbHash = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZggG3cG6ZBJX7P2qVv5v5v5v5v5v5v5v";
    console.log("\n4. Test avec hash actuel de la base:");
    console.log("Hash DB:", dbHash.substring(0, 60));
    
    const dbBcryptValid = await bcrypt.compare(password, dbHash);
    console.log("Bcrypt.compare avec hash DB:", dbBcryptValid);
    
    // 7. Vérifier si le hash DB est bcrypt ou argon2
    console.log("\n5. Analyse du hash DB:");
    if (dbHash.startsWith('$argon2')) {
        console.log("→ C'est un hash argon2");
    } else if (dbHash.startsWith('$2')) {
        console.log("→ C'est un hash bcrypt");
    } else {
        console.log("→ Format inconnu");
    }
}

test().catch(console.error);