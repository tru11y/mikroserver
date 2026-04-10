-- Script pour créer l'admin dans la base de données
-- Exécuter avec: docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < create-admin.sql

-- Supprimer l'ancien admin s'il existe
DELETE FROM users WHERE email = 'admin@mikroserver.local';

-- Créer l'utilisateur admin avec le nouveau mot de passe hashé
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
    'admin@mikroserver.local',
    '$argon2id$v=19$m=65536,t=3,p=4$AhH9CAErYCwKPp7svGIuuvw$kddKgORuJTvjqIzNnhdFFa4V19H2NuD6GXfe9X18ldg',
    'Super',
    'Admin',
    'SUPER_ADMIN',
    'ACTIVE',
    NOW(),
    '[]',
    NOW(),
    NOW()
);

SELECT 'Admin créé avec succès!' as result;
