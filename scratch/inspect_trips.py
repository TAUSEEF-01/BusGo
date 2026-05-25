import urllib.request
import json

try:
    url = 'http://localhost:8085/api/operators/trips/'
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode())
        trips = res.get('data', [])
        for t in trips:
            print(f"ID: {t.get('trip_id')} | Route: {t.get('origin_city')} -> {t.get('destination_city')} | Fare: {t.get('fare_amount')} | Dep: {t.get('departure_datetime')} | Avail: {t.get('available_seats')}")
except Exception as e:
    print(f"Error fetching: {e}")
