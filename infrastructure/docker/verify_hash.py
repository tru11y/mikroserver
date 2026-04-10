#!/usr/bin/env python3
import subprocess
import json

# Get full hash from database
cmd = "docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -t -c 'SELECT password_hash FROM users WHERE email = \"admin@mikroserver.local\"'"
result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
hash_db = result.stdout.strip()

print("Hash from DB:", hash_db)
print("Hash length:", len(hash_db))

# Create a Node.js script to verify
node_script = f"""
const argon2 = require('argon2');
const hash = `{hash_db}`;

async function test() {{
    console.log('Testing hash...');
    console.log('Hash:', hash);
    console.log('Hash length:', hash.length);
    
    try {{
        const result = await argon2.verify(hash, 'Admin123!');
        console.log('Verify Admin123!:', result);
    }} catch (e) {{
        console.error('Error:', e.message);
    }}
}}

test();
"""

# Write and run Node script
with open('/tmp/verify_hash.js', 'w') as f:
    f.write(node_script)

cmd2 = "cd /root/mikroserver/backend && node /tmp/verify_hash.js"
result2 = subprocess.run(cmd2, shell=True, capture_output=True, text=True)
print("\nNode verification result:")
print(result2.stdout)
if result2.stderr:
    print("Error:", result2.stderr)