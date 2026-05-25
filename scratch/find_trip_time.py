import urllib.request
import json
from datetime import datetime
import zoneinfo

try:
    url = 'http://localhost:8085/api/operators/trips/'
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode())
        trips = res.get('data', [])
        for t in trips:
            dep_str = t.get('departure_datetime')
            dt = datetime.fromisoformat(dep_str.replace('Z', '+00:00'))
            # convert to local time of the user (UTC+6)
            local_dt = dt.astimezone(zoneinfo.ZoneInfo("Asia/Dhaka"))
            time_str = local_dt.strftime("%I:%M %p")
            print(f"ID: {t.get('trip_id')} | Route: {t.get('origin_city')} -> {t.get('destination_city')} | Local Dep: {time_str} ({local_dt.isoformat()}) | Fare: {t.get('fare_amount')} | Avail: {t.get('available_seats')}")
except Exception as e:
    print(f"Error: {e}")
