import requests
import json

def test():
    operator_id = "d27c1afc-57c5-4832-92dc-db6e64039aad"
    
    # 1. Test bookings endpoint
    bookings_url = f"http://localhost:8085/api/bookings/operator/{operator_id}?limit=1000"
    print(f"Testing Bookings Endpoint: {bookings_url}")
    try:
        res = requests.get(bookings_url)
        print(f"Status Code: {res.status_code}")
        data = res.json()
        print(f"Success: {data.get('success')}")
        bookings = data.get('data', [])
        print(f"Count of bookings: {len(bookings)}")
        if bookings:
            print("First booking status:", bookings[0].get('status'))
            print("First booking fare:", bookings[0].get('total_fare'))
            print("First booking created_at:", bookings[0].get('created_at'))
    except Exception as e:
        print(f"FAILED bookings fetch: {e}")
        
    print("\n-------------------------------\n")
    
    # 2. Test trips endpoint
    trips_url = f"http://localhost:8085/api/operators/trips/"
    print(f"Testing Trips Endpoint: {trips_url}")
    try:
        res = requests.get(trips_url)
        print(f"Status Code: {res.status_code}")
        data = res.json()
        print(f"Success: {data.get('success')}")
        trips = data.get('data', [])
        print(f"Count of trips: {len(trips)}")
        if trips:
            print("First trip status:", trips[0].get('status'))
            print("First trip operator_id:", trips[0].get('operator_id'))
    except Exception as e:
        print(f"FAILED trips fetch: {e}")

if __name__ == "__main__":
    test()
