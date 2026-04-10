#!/bin/bash
echo "=== DATABASE CHECK ==="
echo "Current users in database:"

docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c "
SELECT 
    email, 
    role, 
    status,
    length(password_hash) as hash_length,
    substr(password_hash, 1, 70) as hash_start,
    CASE 
        WHEN password_hash LIKE '\$2%' THEN 'bcrypt'
        WHEN password_hash LIKE '\$argon2%' THEN 'argon2'
        ELSE 'unknown'
    END as hash_type
FROM users;"