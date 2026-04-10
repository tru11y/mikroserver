#!/usr/bin/env python3
import subprocess
import requests
import json
import time

# Reset failed login attempts
reset_sql = "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'admin@mikroserver.local';"
cmd = f"docker exec docker-postgres-1 psql -U mikroserver -d mikroserver -c '{reset_sql}'"
result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
print("Reset result:", result.stdout.strip() if result.stdout else "None")
if result.stderr:
    print("Reset error:", result.stderr.strip())

# Wait a moment
time.sleep(1)

# Test login with password "admin"
url = "http://localhost:3000/api/v1/auth/login"
headers = {"Content-Type": "application/json"}

# Test with password "admin"
data_admin = {
    "email": "admin@mikroserver.local",
    "password": "admin"
}

print("\n--- Testing with password 'admin' ---")
print("Data:", json.dumps(data_admin, indent=2))

response = requests.post(url, headers=headers, json=data_admin, timeout=10)

print("\nResponse status code:", response.status_code)
print("Response headers:", dict(response.headers))
print("Response body:")
try:
    print(json.dumps(response.json(), indent=2))
except:
    print(response.text)

# Also test with "Admin123!" just in case
data_admin123 = {
    "email": "admin@mikroserver.local",
    "password": "Admin123!"
}

print("\n--- Testing with password 'Admin123!' ---")
print("Data:", json.dumps(data_admin123, indent=2))

response2 = requests.post(url, headers=headers, json=data_admin123, timeout=10)

print("\nResponse status code:", response2.status_code)
print("Response body:")
try:
    print(json.dumps(response2.json(), indent=2))
except:
    print(response2.text)