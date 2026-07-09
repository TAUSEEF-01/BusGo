# BusGo — curl commands for unit testing each service

All requests go through the **Kong gateway** at `http://localhost:18085`
(`strip_path` is on, so `/api/auth/login` reaches the service as `/login`).

> Tip: on Windows use **Git Bash** for these, or swap `\` line-continuations for
> backticks in PowerShell. Replace `REPLACE_*` placeholders with real IDs.

Set a base var first:
```bash
KONG=http://localhost:18085
```

---

## 0. Health & readiness (works for ALL 13 services)

Liveness (always 200 if the process is up) — note the `instance` field reveals which replica answered:
```bash
for s in auth search bookings inventory payments bank tickets notifications cancellations operators deals admin audit; do
  printf "%-15s " "$s"; curl -s -o /dev/null -w "%{http_code}\n" $KONG/api/$s/health
done
```

Readiness (200 only if DB + Redis reachable, else 503):
```bash
curl -s $KONG/api/bookings/health/ready | jq
# {"status":"ready","service":"booking-service","checks":{"database":"ok","redis":"ok"}}
```

---

## 1. auth-service  `/api/auth`
```bash
# Register
curl -s -X POST $KONG/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Test User","phone":"01711111111","email":"testuser@example.com","password":"Test@1234"}' | jq

# Login (uses phone + password) -> returns access_token
curl -s -X POST $KONG/api/auth/login -H 'Content-Type: application/json' \
  -d '{"phone":"01711111111","password":"Test@1234"}' | jq

# Capture the token for authenticated calls below
TOKEN=$(curl -s -X POST $KONG/api/auth/login -H 'Content-Type: application/json' \
  -d '{"phone":"01711111111","password":"Test@1234"}' | jq -r '.access_token // .data.access_token')

# Current user
curl -s $KONG/api/auth/me -H "Authorization: Bearer $TOKEN" | jq
```

## 2. search-service  `/api/search`
```bash
curl -s "$KONG/api/search/cities" | jq
curl -s "$KONG/api/search/buses?origin=Dhaka&destination=Comilla&date=2026-07-01" | jq
curl -s "$KONG/api/search/buses/REPLACE_WITH_TRIP_ID" | jq
```

## 3. operator-service  `/api/operators`
```bash
curl -s $KONG/api/operators/operators/ | jq        # list operators
curl -s $KONG/api/operators/trips/ | jq            # list trips
curl -s $KONG/api/operators/trips/REPLACE_WITH_TRIP_ID | jq
```

## 3b. transit-service  `/api/transit`  (multi-leg connecting journeys — no auth)
```bash
# Find connecting journeys when there's no direct bus (Dhaka -> Comilla -> Sylhet)
curl -s "$KONG/api/transit/search?origin=Dhaka&destination=Sylhet&journey_date=2026-08-15" | jq '.data.itineraries[] | {source, legs: [.legs[] | "\(.origin_city)->\(.destination_city)"], total_fare, final_fare, transfers}'
```

Book a whole journey (all legs at once; auth required). Build `legs` from the
itinerary the search returned:
```bash
curl -s -X POST $KONG/api/bookings/journeys/ -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
  "origin":"Dhaka","destination":"Sylhet",
  "legs":[
    {"trip_id":"LEG1_TRIP","operator_id":"OP","seat_numbers":["A1"],"boarding_point":"Dhaka","dropping_point":"Comilla","journey_date":"2026-08-15","departure_time":"08:00:00","fare":500},
    {"trip_id":"LEG2_TRIP","operator_id":"OP","seat_numbers":["A1"],"boarding_point":"Comilla","dropping_point":"Sylhet","journey_date":"2026-08-15","departure_time":"12:00:00","fare":700}
  ],
  "passenger_details":[{"name":"T","age":30,"gender":"male","seat":"A1"}],
  "total_fare":1200,"idempotency_key":"'$(uuidgen)'"
}' | jq
# -> if any leg's seats are unavailable: 409 and NO seats are held (saga compensation)

curl -s $KONG/api/bookings/journeys/JOURNEY_ID -H "Authorization: Bearer $TOKEN" | jq   # journey + legs
```

Operator: publish a curated transit route (ranks above auto-discovered):
```bash
curl -s -X POST $KONG/api/operators/transit-routes/ -H "Authorization: Bearer $OP_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Dhaka-Sylhet Express Connection","origin_city":"Dhaka","destination_city":"Sylhet","via_cities":["Comilla"],"combined_discount_pct":10,"operator_id":"OPERATOR_ID"}' | jq
curl -s "$KONG/api/operators/transit-routes/?origin=Dhaka&destination=Sylhet" | jq   # public list (transit-service uses this)
```

## 4. inventory-service  `/api/inventory`  (seat locking — no auth needed)
```bash
TRIP=REPLACE_WITH_TRIP_ID

# View seats (auto-initializes a layout for real trips)
curl -s $KONG/api/inventory/trips/$TRIP/seats | jq
curl -s $KONG/api/inventory/trips/$TRIP/available-count | jq

# Lock a seat (atomic — second caller on same seat gets 409)
curl -s -X POST $KONG/api/inventory/trips/$TRIP/seats/lock -H 'Content-Type: application/json' \
  -d '{"seat_numbers":["A1"],"booking_id":"00000000-0000-0000-0000-0000000000aa","user_id":"00000000-0000-0000-0000-0000000000bb"}' | jq

# Release it again
curl -s -X POST $KONG/api/inventory/trips/$TRIP/seats/release -H 'Content-Type: application/json' \
  -d '{"seat_numbers":["A1"],"booking_id":"00000000-0000-0000-0000-0000000000aa"}' | jq
```

## 5. deals-service  `/api/deals`
```bash
curl -s $KONG/api/deals/promos/ | jq
curl -s $KONG/api/deals/flash-sales/ | jq

# Validate a promo (returns discount_amount + final_fare)
curl -s -X POST $KONG/api/deals/validate-promo -H 'Content-Type: application/json' \
  -d '{"code":"BUSGO20","trip_id":"11111111-1111-1111-1111-111111111111","fare_amount":1000,"user_id":"22222222-2222-2222-2222-222222222222"}' | jq

# Consume a promo (one-use-per-user; decrements remaining uses)
curl -s -X POST $KONG/api/deals/apply-promo -H 'Content-Type: application/json' \
  -d '{"code":"BUSGO20","user_id":"22222222-2222-2222-2222-222222222222"}' | jq
```

## 6. booking-service  `/api/bookings`  (auth required)
```bash
# Create a booking (locks seats). Needs a real trip_id/operator_id + $TOKEN.
curl -s -X POST $KONG/api/bookings/ -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"trip_id":"REPLACE","operator_id":"REPLACE","seat_numbers":["A1"],"passenger_details":[{"name":"T","age":30,"gender":"male","seat":"A1"}],"boarding_point":"Dhaka","dropping_point":"Comilla","journey_date":"2026-07-01","departure_time":"08:00:00","total_fare":850,"idempotency_key":"'$(uuidgen)'"}' | jq

curl -s $KONG/api/bookings/my -H "Authorization: Bearer $TOKEN" | jq
curl -s $KONG/api/bookings/REPLACE_BOOKING_ID -H "Authorization: Bearer $TOKEN" | jq

# Apply a promo to a created booking (persists the discount)
curl -s -X POST $KONG/api/bookings/REPLACE_BOOKING_ID/apply-promo -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"promo_code":"BUSGO20"}' | jq
```

## 7. payment-service  `/api/payments`  (auth required)
```bash
curl -s $KONG/api/payments/my -H "Authorization: Bearer $TOKEN" | jq

# Initiate payment (amount must equal total_fare - discount_amount, else 400/fraud)
curl -s -X POST $KONG/api/payments/initiate -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"booking_id":"REPLACE","trip_id":"REPLACE","amount":850,"method":"BKASH","mobile_number":"01711111111","pin":"1234"}' | jq
```

## 8. bank-service  `/api/bank`  (auth required)
```bash
curl -s $KONG/api/bank/accounts/my -H "Authorization: Bearer $TOKEN" | jq
curl -s $KONG/api/bank/transactions/my -H "Authorization: Bearer $TOKEN" | jq
```

## 9. ticket-service  `/api/tickets`  (auth required)
```bash
curl -s $KONG/api/tickets/my -H "Authorization: Bearer $TOKEN" | jq
curl -s $KONG/api/tickets/booking/REPLACE_BOOKING_ID -H "Authorization: Bearer $TOKEN" | jq
```

## 10. notification-service  `/api/notifications`  (auth required)
```bash
curl -s $KONG/api/notifications/ -H "Authorization: Bearer $TOKEN" | jq
curl -s $KONG/api/notifications/stats -H "Authorization: Bearer $TOKEN" | jq
```

## 11. cancellation-service  `/api/cancellations`  (auth required)
```bash
curl -s $KONG/api/cancellations/booking/REPLACE_BOOKING_ID -H "Authorization: Bearer $TOKEN" | jq
```

## 12. admin-service  `/api/admin`  (admin token required)
```bash
curl -s $KONG/api/admin/dashboard-stats -H "Authorization: Bearer $ADMIN_TOKEN" | jq
curl -s $KONG/api/admin/users -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

## 13. audit-service  `/api/audit`  (admin token required)
```bash
curl -s $KONG/api/audit/logs -H "Authorization: Bearer $ADMIN_TOKEN" | jq
curl -s $KONG/api/audit/logs/booking/REPLACE_BOOKING_ID -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

---

## Load-balancing — see which replica answers
```bash
# auth/search/booking run 3 replicas; the instance field shows the container that served it
for i in $(seq 1 12); do curl -s $KONG/api/auth/health | jq -r .instance; done | sort | uniq -c
```

## Failover — kill a replica, traffic keeps flowing
```bash
docker kill infrastructure-auth-service-2
for i in $(seq 1 10); do curl -s -o /dev/null -w "%{http_code} " $KONG/api/auth/health; done; echo
docker start infrastructure-auth-service-2
docker exec infrastructure-kong-1 kong reload   # refresh DNS/balancer after scaling
```

## Kong upstream health (admin API)
```bash
curl -s http://localhost:18089/upstreams/auth-upstream/health | jq '.data[] | {target,health}'
```
