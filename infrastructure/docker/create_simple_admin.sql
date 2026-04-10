-- Supprimer l'ancien admin
DELETE FROM users WHERE email = 'admin@mikroserver.local';

-- Créer un nouvel admin avec un mot de passe simple "admin" hashé avec argon2
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
    '$argon2id$v=19$m=65536,t=3,p=4$PK0peCt4j+W0MGL6Q35uzQ$0jl2nW63dObboczciCjZ+sniiGjICwtqDQA3vrUFGih5s',
    'Super',
    'Admin',
    'SUPER_ADMIN',
    'ACTIVE',
    NOW(),
    '[]',
    NOW(),
    NOW()
);

SELECT 'Nouvel admin créé avec succès! Mot de passe: admin' as result;