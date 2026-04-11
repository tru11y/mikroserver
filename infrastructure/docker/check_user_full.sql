SELECT 
    id,
    email,
    role,
    status,
    failed_login_attempts,
    locked_until,
    last_login_at,
    password_changed_at,
    LEFT(password_hash, 60) as hash_start,
    LENGTH(password_hash) as hash_length
FROM users 
WHERE email = 'admin@mikroserver.local';
