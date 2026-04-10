-- Supprimer l'ancien admin
DELETE FROM users WHERE email = 'admin@mikroserver.local';

-- Créer un nouvel admin avec un mot de passe valide "password123" hashé avec argon2
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
    '$argon2id$v=19$m=65536,t=3,p=4$6xNefanWb3K79RT6msUtFA$gXIFbjIUXdhQdYr+0j9i51sODQDDYq0Sr7vrQQ7HhEBg',
    'Super',
    'Admin',
    'SUPER_ADMIN',
    'ACTIVE',
    NOW(),
    '[]',
    NOW(),
    NOW()
);

-- Reset des tentatives de login
UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'admin@mikroserver.local';

SELECT 'Nouvel admin créé avec succès! Mot de passe: password123' as result;