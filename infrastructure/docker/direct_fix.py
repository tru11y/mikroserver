#!/usr/bin/env python3
import subprocess
import sys
import time
import os

def run_cmd(cmd, description=""):
    if description:
        print(f"\n--- {description} ---")
    print(f"$ {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(f"stderr: {result.stderr}", file=sys.stderr)
    return result

def main():
    print("=== DIRECT FIX FOR MIKROSERVER AUTHENTICATION ===")
    
    # 1. Vérifier que l'API fonctionne
    print("\n1. Vérification API...")
    health = run_cmd("curl -s -f http://localhost:3000/api/v1/health/live", "Health check")
    if health.returncode != 0:
        print("❌ API non accessible, démarrage de l'API...")
        run_cmd("cd /root/mikroserver && docker compose -f infrastructure/docker/docker-compose.prod.yml up -d api", "Démarrage API")
        time.sleep(10)
        run_cmd("curl -s http://localhost:3000/api/v1/health/live", "Vérification après démarrage")
    
    # 2. Vérifier bcrypt dans le container
    print("\n2. Vérification bcrypt dans le container API...")
    run_cmd("docker exec docker-api-1 sh -c 'cd /app && ls node_modules/ | grep -i bcrypt || echo \"bcrypt non trouvé\"'", "Recherche bcrypt")
    
    # 3. Installer bcrypt si nécessaire
    print("\n3. Installation de bcrypt si nécessaire...")
    check_bcrypt = run_cmd("docker exec docker-api-1 sh -c 'cd /app && node -e \"try { require(\"bcrypt\"); console.log(\"BCRYPT_OK\"); } catch(e) { console.log(\"BCRYPT_MISSING\"); }\"'", "Vérification bcrypt module")
    
    if "BCRYPT_MISSING" in check_bcrypt.stdout or "bcrypt non trouvé" in check_bcrypt.stdout:
        print("Installation de bcrypt...")
        run_cmd("docker exec docker-api-1 sh -c 'cd /app && npm install bcrypt@^5.1.1 --legacy-peer-deps'", "Installation bcrypt")
        time.sleep(3)
    
    # 4. Générer un hash bcrypt pour "12345678"
    print("\n4. Génération d'un hash bcrypt...")
    
    bcrypt_code = '''
    const bcrypt = require("bcrypt");
    const saltRounds = 10;
    
    async function main() {
        const password = "12345678";
        console.log("Génération pour:", password);
        
        try {
            const hash = await bcrypt.hash(password, saltRounds);
            console.log("BCRYPT_HASH_RESULT:" + hash);
            
            // Vérification
            const verify = await bcrypt.compare(password, hash);
            console.log("BCRYPT_VERIFY:" + verify);
        } catch (e) {
            console.error("Erreur:", e.message);
            process.exit(1);
        }
    }
    
    main();
    '''
    
    with open("/tmp/generate_bcrypt_direct.js", "w") as f:
        f.write(bcrypt_code)
    
    run_cmd("docker cp /tmp/generate_bcrypt_direct.js docker-api-1:/tmp/generate_bcrypt_direct.js", "Copie du script")
    result = run_cmd("docker exec docker-api-1 node /tmp/generate_bcrypt_direct.js", "Génération hash")
    
    # Extraire le hash
    hash_line = [line for line in result.stdout.split('\n') if "BCRYPT_HASH_RESULT:" in line]
    if not hash_line:
        print("❌ Impossible de générer le hash bcrypt")
        return
    
    hash_value = hash_line[0].split("BCRYPT_HASH_RESULT:")[1].strip()
    print(f"Hash généré: {hash_value[:50]}...")
    
    # 5. Créer l'utilisateur admin
    print("\n5. Création de l'utilisateur admin...")
    
    sql_script = f"""
-- Supprimer les anciens admins
DELETE FROM users WHERE email IN ('admin@mikroserver.local', 'admin@mikroserver.com');

-- Créer le nouvel admin avec hash bcrypt
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
    '{hash_value}',
    'Super',
    'Admin',
    'SUPER_ADMIN',
    'ACTIVE',
    NOW(),
    '[]',
    NOW(),
    NOW()
);

SELECT '✅ Admin créé avec succès!' as message;
"""
    
    with open("/tmp/create_admin_direct.sql", "w") as f:
        f.write(sql_script)
    
    run_cmd("docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < /tmp/create_admin_direct.sql", "Création utilisateur")
    
    # 6. Vérifier
    print("\n6. Vérification des utilisateurs...")
    run_cmd("docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c \"SELECT email, role, status, length(password_hash) as hash_len FROM users;\"", "Vérification base")
    
    # 7. Redémarrer l'API pour prendre en compte les changements
    print("\n7. Redémarrage de l'API...")
    run_cmd("docker restart docker-api-1", "Redémarrage API")
    time.sleep(5)
    
    # 8. Test de connexion
    print("\n8. Test de connexion final...")
    
    curl_cmd = '''curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\\nHTTP Status: %{http_code}\\n"'''
    
    run_cmd(curl_cmd, "Test connexion")
    
    print("\n" + "="*50)
    print("RÉCAPITULATIF:")
    print("  Email: admin@mikroserver.com")
    print("  Mot de passe: 12345678")
    print("  Dashboard: http://139.84.241.27:3001")
    print("  API: http://139.84.241.27:3000")
    print("="*50)

if __name__ == "__main__":
    main()