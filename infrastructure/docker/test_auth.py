#!/usr/bin/env python3
import requests
import json
import sys

def test_auth():
    print("=== TEST AUTHENTIFICATION MIKROSERVER ===")
    
    url = "http://localhost:3000/api/v1/auth/login"
    data = {
        "email": "admin@mikroserver.com",
        "password": "12345678"
    }
    
    print(f"URL: {url}")
    print(f"Données: {json.dumps(data, indent=2)}")
    
    try:
        response = requests.post(url, json=data, timeout=10)
        print(f"\nCode HTTP: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ CONNEXION RÉUSSIE!")
            print(f"Utilisateur: {result['data']['user']['email']}")
            print(f"Rôle: {result['data']['user']['role']}")
            print(f"Access token (début): {result['data']['tokens']['accessToken'][:50]}...")
            return True
        else:
            print("❌ ÉCHEC DE CONNEXION")
            print(f"Réponse: {response.text}")
            
            # Tester avec d'autres identifiants possibles
            test_users = [
                ("admin@mikroserver.local", "12345678"),
                ("admin@mikroserver.com", "password"),
            ]
            
            for email, password in test_users:
                print(f"\nTest avec {email} / {password}")
                test_resp = requests.post(url, json={"email": email, "password": password}, timeout=5)
                print(f"  Code: {test_resp.status_code}")
                if test_resp.status_code == 200:
                    print(f"  ✅ Connexion réussie avec {email}")
                    return True
            
            return False
            
    except Exception as e:
        print(f"❌ Erreur de requête: {e}")
        return False

if __name__ == "__main__":
    success = test_auth()
    sys.exit(0 if success else 1)