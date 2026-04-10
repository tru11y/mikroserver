-- Débloquer l'utilisateur et réinitialiser les tentatives
UPDATE users 
SET 
    failed_login_attempts = 0,
    locked_until = NULL,
    last_login_at = NULL
WHERE email = 'admin@mikroserver.local';

-- Vérifier
SELECT 
    email,
    role,
    status,
    failed_login_attempts,
    locked_until,
    last_login_at
FROM users 
WHERE email = 'admin@mikroserver.local';