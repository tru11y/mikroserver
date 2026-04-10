#!/usr/bin/env python3
import requests
import json

url = "http://localhost:3000/api/v1/auth/login"
headers = {"Content-Type": "application/json"}
data = {
    "email": "admin@mikroserver.local",
    "password": "Admin123!"
}

print("Sending request to:", url)
print("Data:", json.dumps(data, indent=2))

response = requests.post(url, headers=headers, json=data, timeout=10)

print("\nResponse status code:", response.status_code)
print("Response headers:", dict(response.headers))
print("Response body:")
try:
    print(json.dumps(response.json(), indent=2))
except:
    print(response.text)