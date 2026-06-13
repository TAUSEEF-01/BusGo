import requests

def main():
    # Login
    login_url = "https://busgo.farefin.com/api/auth/login"
    login_data = {
        "phone": "12345678",
        "password": "12345678",
        "expected_role": "OPERATOR"
    }
    
    print("Logging in...")
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
    
    # Payload for a test route (Dhaka -> Bogra)
    payload = {
        "origin_city": "Dhaka",
        "destination_city": "Bogra",
        "distance_km": 200,
        "estimated_duration_hours": 5,
        "boarding_points": [
            {"name": "Gabtoli", "address": "Gabtoli Bus Stand", "lat": 23.78, "lng": 90.34}
        ],
        "dropping_points": [
            {"name": "Bogra Satmatha", "address": "Satmatha More", "lat": 24.84, "lng": 89.37}
        ]
    }
    
    create_url = f"https://busgo.farefin.com/api/operators/operators/{operator_id}/routes"
    
    # 1. Create the route first time
    print("\nCreating route first time...")
    res1 = requests.post(create_url, json=payload, headers=headers)
    print("First POST status:", res1.status_code)
    try:
        data1 = res1.json()
        print("First POST response:", data1)
        route_id1 = data1.get('data', {}).get('id')
    except Exception as e:
        print("Error parsing first response:", e)
        return
        
    # 2. Create the exact same route second time
    print("\nCreating route second time...")
    res2 = requests.post(create_url, json=payload, headers=headers)
    print("Second POST status:", res2.status_code)
    try:
        data2 = res2.json()
        print("Second POST response:", data2)
        route_id2 = data2.get('data', {}).get('id')
    except Exception as e:
        print("Error parsing second response:", e)
        return

    # Verify ID match and uniqueness
    if route_id1 == route_id2:
        print("\nSUCCESS: Both calls returned the same Route ID! No duplicate created.")
    else:
        print("\nFAILURE: Second call created a new Route ID! Duplicate created.")

    # 3. Clean up (delete the route)
    if route_id1:
        delete_url = f"https://busgo.farefin.com/api/operators/routes/{route_id1}"
        print(f"\nCleaning up: deleting route {route_id1}...")
        del_res = requests.delete(delete_url, headers=headers)
        print("DELETE response status:", del_res.status_code)
        print("DELETE response:", del_res.json())

if __name__ == '__main__':
    main()
