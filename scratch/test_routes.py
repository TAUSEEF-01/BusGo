import requests

def main():
    login_url = "https://busgo.farefin.com/api/auth/login"
    login_data = {
        "phone": "12345678",
        "password": "12345678",
        "expected_role": "OPERATOR"
    }
    
    # Authenticate
    r = requests.post(login_url, json=login_data)
    if r.status_code != 200:
        print("Login failed:", r.text)
        return
    
    token = r.json()['data']['access_token']
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Fetch routes
    routes_url = "https://busgo.farefin.com/api/operators/routes"
    res = requests.get(routes_url, headers=headers)
    print("GET routes status code:", res.status_code)
    try:
        data = res.json()
        print("\nRoutes list from API:")
        for r in data.get('data', []):
            print(f"ID: {r.get('id')} | {r.get('origin_city')} -> {r.get('destination_city')} | Distance: {r.get('distance_km')} km")
    except Exception as e:
        print("Response text:", res.text)

if __name__ == '__main__':
    main()
