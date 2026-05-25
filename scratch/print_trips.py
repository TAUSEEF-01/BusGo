import urllib.request
import json

try:
    url = 'http://localhost:8085/api/operators/trips/'
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode())
        trips = res.get('data', [])
        print(f"Total trips returned from API: {len(trips)}")
        for t in trips:
            print(f"Trip ID: {t.get('trip_id')} | Operator: {t.get('operator_name')} | Departure: {t.get('departure_datetime')} | Available: {t.get('available_seats')}")
except Exception as e:
    print(f"Error fetching: {e}")
