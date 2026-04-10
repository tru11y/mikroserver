#!/bin/bash
set -e

echo "=== DEPLOY FIX TO VPS ==="
echo "This script will fix the authentication issue on the VPS"
echo ""

# 1. Vérifier la connexion SSH
echo "1. Testing SSH connection..."
ssh root@139.84.241.27 "echo 'SSH connection OK' && date"

# 2. Copier les fichiers nécessaires
echo "2. Copying files to VPS..."
scp ../backend/prisma/seed.ts root@139.84.241.27:/tmp/seed_fixed.ts
scp final_fix_all.sh root@139.84.241.27:/tmp/final_fix_all.sh

# 3. Exécuter le script de réparation
echo "3. Running fix script on VPS..."
ssh root@139.84.241.27 "chmod +x /tmp/final_fix_all.sh && /tmp/final_fix_all.sh 2>&1 | tee /tmp/fix.log"

# 4. Vérifier le résultat
echo "4. Checking result..."
ssh root@139.84.241.27 "tail -20 /tmp/fix.log && echo '---' && curl -s http://localhost:3000/api/v1/health/live && echo 'Health check OK'"

# 5. Test final de connexion
echo "5. Final login test..."
ssh root@139.84.241.27 "curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{\"email\":\"admin@mikroserver.com\",\"password\":\"12345678\"}' \
  -s -w '\nHTTP: %{http_code}\n'"

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo "If login fails, check the logs:"
echo "  ssh root@139.84.241.27 'docker logs docker-api-1 --tail 50'"
echo ""
echo "Credentials:"
echo "  Email: admin@mikroserver.com"
echo "  Password: 12345678"
echo "  Dashboard: http://139.84.241.27:3001"
echo "  API: http://139.84.241.27:3000"