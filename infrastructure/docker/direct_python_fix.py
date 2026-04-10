#!/usr/bin/env python3
import subprocess
import time
import sys

def run_command(cmd):
    """Run a shell command and return output"""
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip(), result.stderr.strip(), result.returncode

def main():
    print("=== DIRECT PYTHON FIX ===")
    
    # 1. Install bcrypt in the API container
    print("\n1. Installing bcrypt in API container...")
    stdout, stderr, code = run_command("docker exec docker-api-1 sh -c 'cd /app && npm install bcrypt@^5.1.1 --legacy-peer-deps --silent'")
    if code != 0:
        print(f"Warning: npm install returned {code}")
    
    # 2. Generate bcrypt hash using Python (since node might be having issues)
    print("\n2. Generating bcrypt hash...")
    import bcrypt
    password = "12345678"
    hash_bytes = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=10))
    password_hash = hash_bytes.decode('utf-8')
    
    print(f"Generated hash: {password_hash[:60]}...")
    print(f"Hash length: {len(password_hash)}")
    
    # 3. Verify the hash
    print("\n3. Verifying hash...")
    if bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
        print("✓ Hash verification successful")
    else:
        print("❌ Hash verification failed")
        sys.exit(1)
    
    # 4. Update database
    print("\n4. Updating database...")
    sql = f"""
    DELETE FROM users WHERE email = 'admin@mikroserver.com';
    
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
        'admin@mikroserver.com',
        '{password_hash}',
        'Super',
        'Admin',
        'SUPER_ADMIN',
        'ACTIVE',
        NOW(),
        '[]',
        NOW(),
        NOW()
    );
    
    SELECT 'User updated' as result;
    """
    
    sql_file = "/tmp/update_users.sql"
    with open(sql_file, "w") as f:
        f.write(sql)
    
    stdout, stderr, code = run_command(f"docker exec -i docker-postgres-1 psql -U mikroserver -d mikroserver < {sql_file}")
    print(f"Database update result: {stdout}")
    
    # 5. Restart API
    print("\n5. Restarting API...")
    run_command("docker restart docker-api-1")
    time.sleep(10)
    
    # 6. Wait for API
    print("\n6. Waiting for API...")
    for i in range(10):
        stdout, stderr, code = run_command("curl -s http://localhost:3000/api/v1/health/live")
        if code == 0:
            print("✓ API is responsive")
            break
        print(f"  Waiting ({i+1}/10)...")
        time.sleep(3)
    
    # 7. Test login
    print("\n7. Testing login...")
    login_cmd = """curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mikroserver.com","password":"12345678"}' \
  -s -w "\nHTTP: %{http_code}\n" """
    
    stdout, stderr, code = run_command(login_cmd)
    print(f"Login result:\n{stdout}")
    
    if '"accessToken"' in stdout:
        print("\n🎉 LOGIN SUCCESSFUL!")
        print("\nCredentials:")
        print("  Email: admin@mikroserver.com")
        print("  Password: 12345678")
        print("  Dashboard: http://139.84.241.27:3001")
        print("  API: http://139.84.241.27:3000")
    else:
        print("\n❌ Login failed")
        print("\nChecking API logs...")
        stdout, stderr, code = run_command("docker logs docker-api-1 --tail 30")
        print(f"API logs:\n{stdout}")
    
    print("\n=== DONE ===")

if __name__ == "__main__":
    main()