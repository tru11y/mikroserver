#!/bin/bash
echo "=== FIXING REDIS EVICTION POLICY ==="

# 1. Stop redis
echo "1. Stopping redis..."
docker stop docker-redis-1

# 2. Remove old container
echo "2. Removing old container..."
docker rm docker-redis-1 2>/dev/null || true

# 3. Start redis with correct eviction policy
echo "3. Starting redis with noeviction policy..."
docker run -d \
  --name docker-redis-1 \
  --network docker_mikroserver-internal \
  --restart unless-stopped \
  -v redis-data:/data \
  -e REDIS_PASSWORD=${REDIS_PASSWORD:-mikroserver_redis_password} \
  redis:7-alpine \
  redis-server \
  --requirepass ${REDIS_PASSWORD:-mikroserver_redis_password} \
  --maxmemory 256mb \
  --maxmemory-policy noeviction \
  --appendonly yes \
  --appendfsync everysec

# 4. Wait for redis
echo "4. Waiting for redis..."
sleep 5

# 5. Test redis
echo "5. Testing redis..."
if docker exec docker-redis-1 redis-cli --pass ${REDIS_PASSWORD:-mikroserver_redis_password} ping | grep -q PONG; then
    echo "✅ Redis is working with correct eviction policy"
    
    # Check eviction policy
    POLICY=$(docker exec docker-redis-1 redis-cli --pass ${REDIS_PASSWORD:-mikroserver_redis_password} config get maxmemory-policy | grep -v maxmemory-policy)
    echo "   Current eviction policy: $POLICY"
    
    if [ "$POLICY" = "noeviction" ]; then
        echo "✅ Eviction policy correctly set to noeviction"
    else
        echo "❌ Eviction policy is $POLICY (should be noeviction)"
    fi
else
    echo "❌ Redis failed to start"
fi

echo ""
echo "=== REDIS FIX COMPLETE ==="