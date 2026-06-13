import requests

def main():
    # Login
    login_url = "https://busgo.farefin.com/api/auth/login"
    login_data = {
        "phone": "12345678",
        "password": "12345678",
        "expected_role": "OPERATOR"
    }
    
    print("Logging in to operator1...")
    r = requests.post(login_url, json=login_data)
    if r.status_code != 200:
        print("Login failed:", r.status_code, r.text)
        return
        
    res_data = r.json()
    token = res_data['data']['access_token']
    operator_id = res_data['data']['user']['id']
    print(f"Logged in successfully. Operator ID: {operator_id}")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Let's list routes by hitting the operator's specific routes list endpoint
    # which is GET /api/operators/operators/{operator_id}/routes
    routes_url = f"https://busgo.farefin.com/api/operators/operators/{operator_id}/routes"
    print(f"Fetching routes from {routes_url}...")
    res = requests.get(routes_url, headers=headers)
    print("GET routes status code:", res.status_code)
    
    try:
        routes_data = res.json()
        routes = routes_data.get('data', [])
        print(f"Found {len(routes)} routes:")
        for route in routes:
            route_id = route.get('id')
            origin = route.get('origin_city')
            dest = route.get('destination_city')
            print(f"  Route ID: {route_id} | {origin} -> {dest}")
            
            # Try to delete this route
            delete_url = f"https://busgo.farefin.com/api/operators/routes/{route_id}"
            print(f"  Attempting to delete route via {delete_url}...")
            del_res = requests.delete(delete_url, headers=headers)
            print(f"  DELETE response status: {del_res.status_code}")
            try:
                print(f"  DELETE response JSON: {del_res.json()}")
            except Exception:
                print(f"  DELETE response text: {del_res.text}")
    except Exception as e:
        print("Error processing routes:", e)
        print("Response text:", res.text)

if __name__ == '__main__':
    main()
