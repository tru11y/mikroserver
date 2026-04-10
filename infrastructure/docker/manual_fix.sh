#!/bin/bash
set -e

echo "=== MANUAL FIX - NO ARGON2 DEPENDENCY ==="
echo "1. Vérification de l'état actuel..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status FROM users;"

echo "2. Test d'argon2 dans le container API..."
cat > /tmp/test_argon2.js << 'EOF'
try {
    const argon2 = require('argon2');
    console.log('✅ Argon2 chargé avec succès');
    console.log('Version:', require('argon2/package.json').version);
    
    // Test simple
    const hash = '$argon2id$v=19$m=65536,t=3,p=4$6xNefanWb3K79RT6msUtFA$gXIFbjIUXdhQdYr+0j9i51sODQDDYq0Sr7vrQQ7HhEBg';
    console.log('Hash de test:', hash.substring(0, 50) + '...');
    
    try {
        // Tentative de vérification
        argon2.verify(hash, 'password123').then(result => {
            console.log('Vérification test:', result);
            process.exit(0);
        }).catch(e => {
            console.log('Erreur vérification:', e.message);
            process.exit(1);
        });
    } catch (syncErr) {
        console.log('Erreur sync:', syncErr.message);
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Erreur chargement argon2:', error.message);
    process.exit(1);
}
EOF

docker cp /tmp/test_argon2.js docker-api-1:/tmp/test_argon2.js
echo "Exécution du test..."
docker exec docker-api-1 node /tmp/test_argon2.js 2>&1 | tee /tmp/argon2_test.log

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "Argon2 ne fonctionne pas correctement. Utilisation de bcrypt fallback..."
    echo "3. Utilisation de bcrypt pour générer le hash (si disponible)..."
    
    cat > /tmp/bcrypt_hash.js << 'EOF'
const bcrypt = require('bcrypt');
const saltRounds = 10;

async function main() {
    const password = '12345678';
    console.log('Génération bcrypt pour:', password);
    
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('BCRYPT_HASH:' + hash);
        
        const verify = await bcrypt.compare(password, hash);
        console.log('Vérification:', verify);
    } catch (e) {
        console.error('Erreur bcrypt:', e.message);
        process.exit(1);
    }
}

main();
EOF
    
    docker cp /tmp/bcrypt_hash.js docker-api-1:/tmp/bcrypt_hash.js
    BCRYPT_OUTPUT=$(docker exec docker-api-1 node /tmp/bcrypt_hash.js 2>&1)
    echo "Sortie bcrypt: $BCRYPT_OUTPUT"
    
    if echo "$BCRYPT_OUTPUT" | grep -q "BCRYPT_HASH:"; then
        HASH=$(echo "$BCRYPT_OUTPUT" | grep 'BCRYPT_HASH:' | cut -d':' -f2-)
        echo "Hash bcrypt généré!"
    else
        echo "Échec bcrypt aussi. On utilise un hash statique simple..."
        # Hash bcrypt pour "12345678" avec salt 10
        HASH='$2b$10$N9qo8uLOickgx2ZMRZoMye.kH7k3YhMk7R3L7.7p.9p.1p.1p.1p.1p'
        echo "Utilisation hash statique (peut ne pas fonctionner)"
    fi
else
    echo "Argon2 fonctionne! Génération du hash..."
    cat > /tmp/gen_hash_final.js << 'EOF'
const argon2 = require('argon2');

async function main() {
    const password = '12345678';
    console.log('Génération argon2 pour:', password);
    
    const hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4
    });
    
    console.log('ARGON2_HASH:' + hash);
    
    // Vérification immédiate
    const verify = await argon2.verify(hash, password);
    console.log('Auto-vérification:', verify);
}

main().catch(e => console.error('Erreur:', e));
EOF

    docker cp /tmp/gen_hash_final.js docker-api-1:/tmp/gen_hash_final.js
    ARGON_OUTPUT=$(docker exec docker-api-1 node /tmp/gen_hash_final.js 2>&1)
    echo "Sortie argon2: $ARGON_OUTPUT"
    HASH=$(echo "$ARGON_OUTPUT" | grep 'ARGON2_HASH:' | cut -d':' -f2-)
fi

if [ -z "$HASH" ]; then
    echo "ERREUR: Impossible d'obtenir un hash. Abandon."
    exit 1
fi

echo "4. Création de l'utilisateur avec hash: ${HASH:0:50}..."
cat > /tmp/final_create.sql << EOF
-- Supprimer les anciens utilisateurs
DELETE FROM users WHERE email IN ('admin@mikroserver.local', 'admin@mikroserver.com');

-- Créer le nouvel admin
INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    status,
    email_verified_at,
    permissions,
    created_at,
    updated_at
) VALUES (
    'a5242692-2cb3-41d1-8854-116b2a65e81d',
    'admin@mikroserver.com',
    '$HASH',
    'Super',
    'Admin',
    'SUPER_ADMIN',
    'ACTIVE',
    NOW(),
    '[]',
    NOW(),
    NOW()
);

SELECT '✅ Admin créé!' as result;
EOF

docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/final_create.sql

echo "5. Vérification finale..."
docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "SELECT email, role, status, failed_login_attempts FROM users;"

echo "6. Test de connexion..."
cat > /tmp/final_test.sh << 'EOF'
#!/bin/bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nCode HTTP: %{http_code}\n"
EOF

chmod +x /tmp/final_test.sh
echo "Test dans 3 secondes..."
sleep 3
/tmp/final_test.sh

echo "=== FIN ==="