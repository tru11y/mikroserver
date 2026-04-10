SELECT 
    password_hash,
    LENGTH(password_hash) as length,
    OCTET_LENGTH(password_hash) as octet_length,
    ENCODE(password_hash::bytea, 'escape') as escaped
FROM users 
WHERE email = 'admin@mikroserver.local';