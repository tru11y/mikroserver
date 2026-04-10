#!/usr/bin/env python3
import requests
import json
import time

url = "http://localhost:3000/api/v1/auth/login"
headers = {"Content-Type": "application/json"}

# Test avec le nouveau mot de passe "password123"
data = {
    "email": "admin@mikroserver.local",
    "password": "password123"
}

print("=== TEST FINAL DE CONNEXION ===")
print("URL:", url)
print("Données:", json.dumps(data, indent=2))
print()

# Faire la requête
response = requests.post(url, headers=headers, json=data, timeout=10)

print("Code statut:", response.status_code)
print("En-têtes:", dict(response.headers))
print()

if response.status_code == 200:
    print("✅ SUCCÈS! Connexion réussie!")
    result = response.json()
    print("\nRéponse complète:")
    print(json.dumps(result, indent=2))
    
    # Extraire les tokens
    if 'data' in result and 'tokens' in result['data']:
        tokens = result['data']['tokens']
        print("\n📋 Tokens obtenus:")
        print(f"  - Access Token: {tokens['accessToken'][:50]}...")
        print(f"  - Refresh Token: {tokens['refreshToken'][:50]}...")
        print(f"  - Access expires in: {tokens['accessExpiresIn']} seconds")
        print(f"  - Refresh expires in: {tokens['refreshExpiresIn']} seconds")
        
    if 'data' in result and 'user' in result['data']:
        user = result['data']['user']
        print(f"\n👤 Utilisateur connecté:")
        print(f"  - ID: {user['id']}")
        print(f"  - Email: {user['email']}")
        print(f"  - Nom: {user['firstName']} {user['lastName']}")
        print(f"  - Rôle: {user['role']}")
        
    print("\n🎉 L'authentification fonctionne correctement!")
    
elif response.status_code == 401:
    print("❌ ÉCHEC! Authentification refusée.")
    try:
        error = response.json()
        print("Erreur:", json.dumps(error, indent=2))
    except:
        print("Réponse:", response.text)
        
    # Vérifier aussi avec d'autres mots de passe
    test_passwords = ['Admin123!', 'admin', 'password123', 'Password123!', 'Password123']
    print("\n🔍 Test avec différents mots de passe:")
    for pwd in test_passwords:
        test_data = {"email": "admin@mikroserver.local", "password": pwd}
        try:
            resp = requests.post(url, headers=headers, json=test_data, timeout=5)
            print(f"  '{pwd}': {resp.status_code}")
        except Exception as e:
            print(f"  '{pwd}': ERROR - {e}")
            
else:
    print("❌ ÉCHEC! Code inattendu:", response.status_code)
    try:
        print("Réponse:", json.dumps(response.json(), indent=2))
    except:
        print("Réponse:", response.text)