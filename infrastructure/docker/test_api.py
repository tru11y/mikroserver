#!/usr/bin/env python3
import requests
import json
import sys

def test_api():
    url = "http://localhost:3000/api/v1/auth/login"
    data = {
        "email": "admin@mikroserver.com",
        "password": "12345678"
    }
    
    print(f"Testing login at {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    
    try:
        response = requests.post(url, json=data, timeout=10)
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ LOGIN SUCCESSFUL!")
            print(f"User: {result['data']['user']['email']}")
            print(f"Role: {result['data']['user']['role']}")
            return True
        else:
            print("❌ LOGIN FAILED")
            print(f"Response: {response.text}")
            
            # Try with different variations
            variations = [
                ("admin@mikroserver.local", "12345678"),
                ("admin@mikroserver.com", "password"),
                ("admin@mikroserver.com", "ChangeMe123!@#"),
            ]
            
            for email, password in variations:
                print(f"\nTrying {email} / {password}")
                resp = requests.post(url, json={"email": email, "password": password}, timeout=5)
                print(f"  Status: {resp.status_code}")
                if resp.status_code == 200:
                    print(f"  ✅ Success with {email}")
                    return True
            
            return False
            
    except Exception as e:
        print(f"❌ Request error: {e}")
        return False

if __name__ == "__main__":
    success = test_api()
    sys.exit(0 if success else 1)