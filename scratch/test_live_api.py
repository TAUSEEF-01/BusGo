import requests

def test():
    base_url = "https://busgo.farefin.com"
    operator_id = "d27c1afc-57c5-4832-92dc-db6e64039aad"
    
    # Test bookings endpoint
    bookings_url = f"{base_url}/api/bookings/operator/{operator_id}?limit=1000"
    print(f"Testing Live Bookings Endpoint: {bookings_url}")
    try:
        res = requests.get(bookings_url)
        print(f"Status Code: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            bookings = data.get('data', [])
            print(f"Bookings Count: {len(bookings)}")
        else:
            print(f"Response: {res.text}")
    except Exception as e:
        print(f"Error querying bookings: {e}")
        
    print("\n-------------------------------\n")
    
    # Test trips endpoint
    trips_url = f"{base_url}/api/operators/trips/"
    print(f"Testing Live Trips Endpoint: {trips_url}")
    try:
        res = requests.get(trips_url)
        print(f"Status Code: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            trips = data.get('data', [])
            print(f"Trips Count: {len(trips)}")
        else:
            print(f"Response: {res.text}")
    except Exception as e:
        print(f"Error querying trips: {e}")

if __name__ == "__main__":
    test()
