# Transit (Multi-Leg / Connecting-Bus) Transportation — Implementation Plan

> **Status:** PLANNED — not yet implemented.
> **Audience:** any engineer or AI model executing this without prior context.
> Follow the phases **in order**. Each phase ends with acceptance criteria; do
> not start the next phase until they pass. Conventions, gotchas, and exact
> file paths are spelled out so there is no ambiguity.

---

## 1. The feature, in plain words

In Bangladesh many origin→destination pairs have **no direct bus**. Passengers
ride bus A to an intermediate city, get off, and board bus B (sometimes C) to
reach their destination. Today BusGo can only search and book **direct trips**
(`search-service` queries Elasticsearch for `origin_city == X AND
destination_city == Y`). If no direct trip exists the user gets nothing.

We will add **transit journeys**: when the user searches Dhaka → Sylhet and no
direct bus exists (or even when it does), the platform proposes **itineraries**
made of 2–3 connecting trip *legs* (e.g. Dhaka→Comilla 08:00–11:00, then
Comilla→Sylhet 12:00–17:00), shows the user exactly where/when to change buses,
books **all legs together** (all-or-nothing), takes **one payment**, and issues
**one ticket per leg**.

Why this showcases microservices (the teacher's point):
- a **new, independently scalable service** (`transit-service`) does the
  CPU-heavy graph search;
- booking multiple legs across services requires a **saga with compensation**
  (lock all legs or release everything);
- the flow **composes** search, inventory, booking, payment, ticket and
  notification services through the gateway and Kafka events.

---

## 2. Architecture decision (locked)

| Concern | Decision |
|---|---|
| Journey planning (find connecting itineraries) | **NEW microservice `transit-service`** (14th service). Stateless; reads trips from **Elasticsearch** (same `bus_trips` index search-service uses). |
| Multi-leg booking | **booking-service** gains a `journeys` table + saga endpoints. Each leg is a normal `bookings` row with new nullable columns `journey_id`, `leg_number`. |
| Seat locking per leg | Existing **inventory-service** endpoints, called once per leg with that **leg's booking_id** (unchanged service). |
| Payment | **One payment for the whole journey.** payment-service `InitiateRequest` gets optional `journey_id`; fraud check validates against the journey's total. |
| Tickets | Unchanged ticket-service: booking-service publishes `ticket.issued` **once per leg** → one ticket per leg (exactly what a passenger needs when changing buses). |
| Failure handling | Reuse existing events. `payment.failed` / `seat.lock.expired` consumers learn to resolve a **journey id** to its legs. |
| Frontend | Search results show itinerary cards; per-leg seat selection stepper; journey payment mode (mirrors the existing round-trip mode); MyBookings groups legs. |

**Terminology used everywhere:** a *journey* = ordered list of *legs*; each leg
= one existing trip. A direct trip is a 1-leg journey.

---

## 3. Constants (use exactly these; put them where stated)

| Constant | Value | Where |
|---|---|---|
| `MIN_TRANSFER_MINUTES` | `30` | transit-service `core/config.py` (env-overridable) |
| `MAX_TRANSFER_WAIT_HOURS` | `6` | same |
| `MAX_LEGS` | `3` | same |
| `MAX_ITINERARIES_RETURNED` | `5` | same |
| Transit host port | `8517` | `infrastructure/.env` (`TRANSIT_SERVICE_PORT=8517`). **Do NOT use 8081-8180 or 8519-8618 — Windows-reserved ranges.** |
| Kong route prefix | `/api/transit` | `infrastructure/kong/kong.yml` |

---

## 4. Known codebase conventions & gotchas (READ BEFORE CODING)

1. **Shared modules** live in `busgo/shared/` and are volume-mounted into every
   container at `/app/shared`. Use them: `shared.health.create_health_router`,
   `shared.observability.setup_observability`, `shared.http_client.ResilientClient`,
   `shared.base_response.BaseResponse`, `shared.enums.BookingStatus`.
2. **Health-route ordering:** include the health router **BEFORE** any router
   that has a greedy root route like `/{id}` — otherwise `/health` returns
   422/401 and Kong marks the service UNHEALTHY. (Already bitten ticket,
   booking, payment, cancellation services.)
3. **Code changes need a container restart** (`docker restart <container>`),
   not a rebuild (source is volume-mounted). New pip deps need `--build`.
4. **After scaling/recreating services, run** `docker exec infrastructure-kong-1 kong reload`
   (Kong caches Docker DNS).
5. **ES index is volatile** (no volume). After a stack recreate, run
   `curl -X POST http://localhost:18085/api/search/reindex` to re-seed
   `bus_trips`. transit-service depends on this index too — mention it in its
   README/docstring.
6. **Services crash-loop if Kafka is down** — if everything 502s, check
   `docker ps -a | grep kafka` first.
7. **Auth:** JWTs are HS256 with `JWT_SECRET=supersecretkey`; payload has
   `user_id` and `role`. Copy `api/deps.py` from booking-service for any new
   service needing auth.
8. **BaseResponse envelope:** all service responses are
   `{"success": bool, "data": ..., "message": ..., "errors": ...}` — EXCEPT
   deals-service which returns raw objects. transit-service MUST use BaseResponse.
9. **prometheus-fastapi-instrumentator is BANNED** (crashes this FastAPI
   version). `shared/observability.py` already does metrics correctly — just
   call `setup_observability(app, SERVICE_NAME)`.
10. Frontend talks to Kong at `http://localhost:18085` (`apiClient` handles
    base URL + auth header).

---

## 5. Phase 1 — `transit-service` (new microservice)

### 5.1 Files to create

```
busgo/services/transit-service/
├── Dockerfile                  # copy from search-service, unchanged pattern
├── requirements.txt
├── main.py
├── core/config.py
├── routers/transit.py
└── services/
    ├── es_svc.py               # thin ES read client
    └── planner.py              # THE ALGORITHM
```

`requirements.txt` (copy search-service's and keep):
```
fastapi
uvicorn[standard]
elasticsearch==8.11.0
redis
httpx
tenacity
python-json-logger
pydantic-settings
```
(No SQLAlchemy — this service has **no database**.)

### 5.2 `core/config.py`

```python
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ELASTICSEARCH_URL: str = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/4")
    INVENTORY_SERVICE_URL: str = os.getenv("INVENTORY_SERVICE_URL", "http://inventory-service:8000")
    MIN_TRANSFER_MINUTES: int = int(os.getenv("MIN_TRANSFER_MINUTES", "30"))
    MAX_TRANSFER_WAIT_HOURS: int = int(os.getenv("MAX_TRANSFER_WAIT_HOURS", "6"))
    MAX_LEGS: int = int(os.getenv("MAX_LEGS", "3"))
    MAX_ITINERARIES_RETURNED: int = int(os.getenv("MAX_ITINERARIES_RETURNED", "5"))

settings = Settings()
```

### 5.3 `services/es_svc.py`

One function: fetch all candidate trips for a date window.

```python
from elasticsearch import AsyncElasticsearch
from core.config import settings

es_client = AsyncElasticsearch(settings.ELASTICSEARCH_URL)
INDEX = "bus_trips"

async def fetch_trips(date_from_iso: str, date_to_iso: str) -> list[dict]:
    """All SCHEDULED trips departing in [date_from, date_to]. Size 1000."""
    query = {
        "query": {"bool": {"must": [
            {"term": {"status": "SCHEDULED"}},
            {"range": {"departure_datetime": {"gte": date_from_iso, "lte": date_to_iso}}},
        ]}},
        "size": 1000,
    }
    res = await es_client.search(index=INDEX, body=query)
    return [h["_source"] for h in res.get("hits", {}).get("hits", [])]
```

Trip documents contain (already in the index): `trip_id, operator_id,
operator_name, bus_type, origin_city, destination_city, departure_datetime,
arrival_datetime, fare_amount, available_seats, status`.

### 5.4 `services/planner.py` — the itinerary algorithm

**Algorithm (bounded DFS over a city graph):**

```
build_itineraries(origin, destination, journey_date):
  1. window = [journey_date 00:00, journey_date+1 06:00]  # allow late-night arrivals of last leg
  2. trips = fetch_trips(window)                          # one ES query
  3. adjacency = dict: origin_city -> [trips departing there], each list
     sorted by departure_datetime
  4. results = []
     dfs(city=origin, arrived_at=None, path=[], visited={origin}):
        if len(path) > MAX_LEGS: return
        if city == destination and path: results.append(path.copy()); return
        for trip in adjacency.get(city, []):
            if trip.destination_city in visited: continue        # no loops
            if arrived_at is not None:
                wait = trip.departure_datetime - arrived_at
                if wait < MIN_TRANSFER_MINUTES: continue         # too tight
                if wait > MAX_TRANSFER_WAIT_HOURS: continue      # absurd wait
            else:
                # first leg must depart on the requested date
                if trip.departure_datetime.date() != journey_date: continue
            if trip.available_seats <= 0: continue
            path.append(trip); visited.add(trip.destination_city)
            dfs(trip.destination_city, trip.arrival_datetime, path, visited)
            path.pop(); visited.remove(trip.destination_city)
  5. Score each itinerary:
        score = (number_of_legs, total_duration_minutes, total_fare)
     Sort ascending (fewer legs first, then faster, then cheaper).
  6. Return top MAX_ITINERARIES_RETURNED.
```

**Parse datetimes** with `datetime.fromisoformat(value.replace("Z", "+00:00"))`
and treat naive values as UTC. All comparisons in UTC.

**Output shape per itinerary** (this exact JSON — the frontend and booking saga
consume it):

```json
{
  "itinerary_id": "<uuid4, generated per response>",
  "legs": [
    {
      "leg_number": 1,
      "trip_id": "…", "operator_id": "…", "operator_name": "…",
      "origin_city": "Dhaka", "destination_city": "Comilla",
      "departure_datetime": "2026-07-10T08:00:00+00:00",
      "arrival_datetime": "2026-07-10T11:00:00+00:00",
      "fare_amount": 500.0, "bus_type": "AC", "available_seats": 32
    }
  ],
  "transfers": [
    {"city": "Comilla", "wait_minutes": 60,
     "arrive": "2026-07-10T11:00:00+00:00", "depart": "2026-07-10T12:00:00+00:00"}
  ],
  "total_fare": 1100.0,
  "total_duration_minutes": 540,
  "leg_count": 2,
  "is_direct": false
}
```

`transfers[i]` describes the change between `legs[i]` and `legs[i+1]`. Direct
trips (1 leg) are included with `is_direct: true, transfers: []`.

### 5.5 `routers/transit.py`

```
GET /search?origin=Dhaka&destination=Sylhet&journey_date=2026-07-10
    -> BaseResponse{data: {"itineraries": [...], "searched": {...}}}
    - Public (no auth), like search-service.
    - Cache the response in Redis key f"transit:{origin}:{destination}:{date}"
      TTL 120s (same RedisSearchService pattern as search-service; copy that
      small class into services/redis_svc.py).
    - If ES is empty/unavailable -> success=True with empty list and message
      "No itineraries found (is the search index seeded? POST /api/search/reindex)".
```

### 5.6 `main.py`

Follow search-service's `main.py` shape exactly, minus DB/Kafka:

```python
app = FastAPI(title="Transit Service", root_path=os.environ.get("ROOT_PATH", ""))
# CORS middleware (copy block), then:
setup_observability(app, SERVICE_NAME)          # SERVICE_NAME=transit-service
app.include_router(create_health_router(SERVICE_NAME, {
    "elasticsearch": es_ping_check,             # custom check, see below
    "redis": redis_check(os.environ.get("REDIS_URL")),
}))                                             # HEALTH FIRST (gotcha #2)
app.include_router(transit_router)
```

`es_ping_check` is a local async function:
```python
async def es_ping_check():
    if not await es_client.ping():
        raise RuntimeError("elasticsearch unreachable")
```

### 5.7 Acceptance criteria (Phase 1)

Run inside the compose network after Phase 2 wiring, or standalone with env
vars pointing at localhost ports:
- `python -m py_compile` passes on every new file.
- `GET /health` → 200 `{"status":"ok","service":"transit-service","instance":...}`.
- `GET /search?origin=Dhaka&destination=Sylhet&journey_date=<a date with seeded connecting trips>`
  returns ≥1 itinerary whose legs chain correctly (leg N departs from leg N-1's
  destination, ≥30 min after its arrival).

---

## 6. Phase 2 — Infrastructure wiring

### 6.1 `busgo/infrastructure/docker-compose.yml`

Add (copy the search-service block shape, single replica, no DB env):

```yaml
  transit-service:
    <<: *service-defaults
    build:
      context: ../services/transit-service
    ports:
      - "${TRANSIT_SERVICE_PORT:-8517}:8000"
    volumes:
      - ../services/transit-service:/app
      - ../shared:/app/shared
    environment:
      REDIS_URL: redis://redis:6379/0
      ELASTICSEARCH_URL: http://elasticsearch:9200
      INVENTORY_SERVICE_URL: http://inventory-service:8000
      JWT_SECRET: supersecretkey
      ENVIRONMENT: development
      SERVICE_NAME: transit-service
      ROOT_PATH: /api/transit
```

Note: `*service-defaults` adds `depends_on: redis, kafka`. transit doesn't use
Kafka but the dependency is harmless — keep the anchor for consistency.

Add `TRANSIT_SERVICE_PORT=8517` to `busgo/infrastructure/.env`.

### 6.2 `busgo/infrastructure/kong/kong.yml`

- Under `services:` add:
  ```yaml
  - name: transit-service
    url: http://transit-upstream
    retries: 3
    routes:
      - name: transit-route
        paths:
          - /api/transit
        strip_path: true
  ```
- Under `upstreams:` add:
  ```yaml
  - name: transit-upstream
    targets: [{ target: "transit-service:8000", weight: 100 }]
    healthchecks: *default-healthchecks
  ```
  (The anchor `&default-healthchecks` is defined on auth-upstream — alias it.)

### 6.3 `busgo/infrastructure/prometheus/prometheus.yml`

Add a scrape job identical to the other 13 (DNS A discovery on
`transit-service`, port 8000).

### 6.4 `busgo/tests/config.json`

- Add to `services`: `{ "name": "transit-service", "prefix": "/api/transit", "replicas": 1, "upstream": "transit-upstream" }`
- Add smoke endpoint: `{ "service": "transit-service", "method": "GET", "path": "/api/transit/search?origin=Dhaka&destination=Sylhet&journey_date=2026-07-10", "expect": 200, "desc": "transit itinerary search" }`

### 6.5 Bring-up commands & acceptance

```bash
cd busgo/infrastructure
docker compose up -d --build transit-service
docker compose up -d --force-recreate --no-deps kong   # kong.yml changed
docker restart infrastructure-prometheus-1
curl -s http://localhost:18085/api/transit/health              # 200
curl -s http://localhost:18089/upstreams/transit-upstream/health  # HEALTHY
cd ../tests && python run_tests.py unit                        # all pass
```

---

## 7. Phase 3 — Booking saga (booking-service)

### 7.1 Model changes — `services/booking-service/models/models.py`

Add to `Booking`:
```python
journey_id = Column(UUID(as_uuid=True), index=True, nullable=True)
leg_number = Column(Integer, nullable=True)   # 1-based; import Integer
```

New table:
```python
class Journey(Base):
    __tablename__ = "journeys"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    origin = Column(String, nullable=False)          # overall journey origin
    destination = Column(String, nullable=False)     # overall journey destination
    leg_count = Column(Integer, nullable=False)
    total_fare = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), default=0.0)
    promo_code = Column(String, nullable=True)
    status = Column(Enum(BookingStatus, name="booking_status"), default=BookingStatus.SEAT_LOCKED)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    payment_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)
```

Tables are created by the existing `Base.metadata.create_all` on startup. The
two new `bookings` columns will NOT be auto-added to the existing table by
create_all — add a startup migration in `main.py` right after create_all,
mirroring the pattern deals-service uses:

```python
from sqlalchemy import text
async with engine.begin() as conn:
    await conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS journey_id UUID"))
    await conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS leg_number INTEGER"))
```

### 7.2 New router — `services/booking-service/routers/journeys.py`

Include in `main.py` AFTER the health router, BEFORE `bookings_router`
(specific paths must not be shadowed; also gotcha #2).

**Schemas** (add to `schemas/schemas.py`):

```python
class JourneyLegCreate(BaseModel):
    trip_id: UUID
    operator_id: UUID
    seat_numbers: List[str]
    boarding_point: str          # leg origin city is fine
    dropping_point: str          # leg destination city
    journey_date: date
    departure_time: time
    fare: float                  # fare_amount * len(seat_numbers)

class JourneyCreate(BaseModel):
    origin: str
    destination: str
    legs: List[JourneyLegCreate]         # 1..3, ordered
    passenger_details: List[PassengerDetail]   # reused for every leg
    total_fare: float                    # must equal sum(leg.fare)
    promo_code: Optional[str] = None
    idempotency_key: str
```

**Endpoint 1 — `POST /journeys/` (auth: any logged-in user).** THE SAGA:

```
1. Idempotency: RedisIdempotencyService.get_idempotency(key) -> return cached.
2. Validate: 1 <= len(legs) <= 3; abs(total_fare - sum(leg.fare)) < 0.01
   else 400.
3. Promo: ExternalServices.validate_promo(promo_code, total_fare,
   str(legs[0].trip_id), user_id) -> discount (0.0 if invalid/absent).
4. journey_id = uuid4(); expires_at = now + 10 min.
5. FOR each leg i (1-based), in order:              # forward phase
      leg_booking_id = uuid4()
      try: ExternalServices.lock_seats(trip_id, seat_numbers,
                                       str(leg_booking_id), user_id)
      except:                                        # COMPENSATION
          for each previously locked leg j:
              ExternalServices.unbook_seats(legs[j].trip_id,
                                            legs[j].seat_numbers,
                                            str(leg_booking_ids[j]))
          raise HTTPException(409, f"Seat(s) unavailable on leg {i} "
                                   f"({leg.boarding_point} → {leg.dropping_point}); "
                                   f"nothing was booked.")
6. Persist ONE Journey row (status SEAT_LOCKED, discount, promo) and one
   Booking row per leg:
      Booking(id=leg_booking_ids[i], journey_id=journey_id, leg_number=i,
              user_id, trip_id, operator_id, seat_numbers,
              passenger_details, boarding_point, dropping_point,
              journey_date, departure_time,
              total_fare=leg.fare, discount_amount=0,   # discount lives on journey
              status=SEAT_LOCKED, idempotency_key=f"{req.idempotency_key}:leg{i}",
              expires_at=expires_at)
   + BookingStatusHistory per leg. Single db.commit().
7. response_data = {journey_id, booking_ids: [...], legs: [...summary...],
                    total_fare, discount_amount, final_fare, expires_at}
8. Cache idempotency; publish Kafka "booking.created" once per leg (existing
   consumers keep working) and "audit.log" {"event":"journey.created", ...}.
9. Return BaseResponse(success=True, data=response_data).
```

**Endpoint 2 — `GET /journeys/{journey_id}`** (auth; owner or role in
OPERATOR/ADMIN). Returns journey + its leg bookings ordered by `leg_number`,
`final_fare = total_fare - discount_amount`. **payment-service calls this.**

**Endpoint 3 — `POST /journeys/{journey_id}/confirm-payment?payment_id=…`**
(no user auth — internal, mirrors the existing per-booking confirm):
```
1. Load journey + legs. If journey.status == CONFIRMED -> idempotent success.
2. journey.status = CONFIRMED; journey.payment_id = payment_id.
   For each leg: status=CONFIRMED, payment_id=payment_id, history row.
3. Consume promo once: ExternalServices.consume_promo(journey.promo_code, user_id).
4. For each leg: ExternalServices.confirm_seats(trip.., seats.., leg_booking_id, user_id)
   (log-and-continue on error, same as single-booking flow)
   + publish "ticket.issued" {"booking_id": leg_id, "user_id":…, "trip_id":…}
   + record_travel(db, leg_booking)          # feeds re-marketing
5. Return BaseResponse(success=True, message="Journey confirmed").
```

**Endpoint 4 — `POST /journeys/{journey_id}/cancel`** (auth: owner).
Same rules as single-booking cancel (only CONFIRMED, within 1h of payment via
`get_payment_completed_at(journey.payment_id)`); refund = 80% of
`(total_fare - discount_amount)` credited ONCE via `credit_refund`; every leg →
CANCELLED + `unbook_seats` + publish `booking.cancelled` per leg.

### 7.3 Failure/expiry handling (reuse existing events)

`services/kafka_consumer.py` — in `process_message`, the lookup currently does
`select(Booking).where(Booking.id == booking_id)` and returns if not found.
Change the not-found branch: **try journeys** —

```
if booking is None:
    journey = select(Journey).where(Journey.id == booking_id)
    if journey is None: return
    legs = select(Booking).where(Booking.journey_id == journey.id)
    if topic == "payment.failed" and journey.status in (SEAT_LOCKED, PAYMENT_PENDING):
        journey.status = EXPIRED
        for leg in legs (if leg.status in (SEAT_LOCKED, PAYMENT_PENDING)):
            leg.status = EXPIRED (+history)
            publish "seat.lock.expired" {booking_id: str(leg.id),
                                         trip_id: str(leg.trip_id),
                                         seat_numbers: leg.seat_numbers}
        commit
```
(inventory-service already releases seats on `seat.lock.expired` — no change
there.) The existing per-booking scheduler also expires stale leg bookings
automatically since legs are ordinary rows with `expires_at`; add one line to
the scheduler: after expiring bookings, set any journey whose legs are all
EXPIRED to EXPIRED.

### 7.4 Acceptance criteria (Phase 3)

Mint a CUSTOMER JWT inside the booking container (see §11 "testing recipe"),
then:
- `POST /api/bookings/journeys/` with 2 valid legs → 200, both legs'
  seats LOCKED in inventory (`GET /api/inventory/trips/{t}/seats`).
- Same request with a seat already taken on leg 2 → **409**, and leg 1's seats
  are back to AVAILABLE (compensation proof — this is the demo money-shot).
- `GET /api/bookings/journeys/{id}` returns legs ordered, correct totals.

---

## 8. Phase 4 — Payment for journeys (payment-service)

### 8.1 `schemas/schemas.py`
`InitiateRequest`: add `journey_id: Optional[UUID] = None` (trip_id stays
required — pass leg 1's trip_id).

### 8.2 `services/booking_client.py`
Add:
```python
@staticmethod
async def get_journey(journey_id: str, auth_token: str) -> Optional[Dict[str, Any]]:
    # GET {BOOKING_SERVICE_URL}/bookings/journeys/{journey_id} with Bearer header
    # return res.json()["data"] on 200 else None
```
Note `BOOKING_SERVICE_URL` in payment config already points at the booking
service root; the existing `get_booking` uses `/bookings/{id}` — journeys hang
off the same prefix: `/bookings/journeys/{id}` **via Kong**, but service-to-
service goes direct (`http://booking-service:8000/journeys/{id}`) because
`strip_path` only applies at Kong. **Check how `get_booking` builds its URL and
mirror it exactly** (it uses `f"{settings.BOOKING_SERVICE_URL}/bookings/{id}"`
where BOOKING_SERVICE_URL includes no `/api` — verify at implementation time;
whatever pattern `get_booking` uses and works, copy it with `journeys/` in the
path).

### 8.3 `routers/payments.py` — `initiate_payment`
Where the fraud check computes `actual_fare`:
```python
if req.journey_id:
    journey = await BookingClient.get_journey(str(req.journey_id), auth_header)
    if journey:
        actual_fare = float(journey["total_fare"]) - float(journey.get("discount_amount", 0))
    else:
        actual_fare = req.amount   # dev fallback, same spirit as bookings
else:
    <existing booking lookup unchanged>
```
Store the payment with `booking_id=req.journey_id or req.booking_id` (the
column is a plain UUID; the journey id is the natural reference). All
`payment.failed` publishes in this endpoint must use that same id so the
journey-aware consumer (Phase 3.3) can resolve it.

### 8.4 Acceptance criteria (Phase 4)
- Initiate with `journey_id` and `amount == journey final fare` → 200.
- Wrong amount → 400 "Payment amount does not match booking fare".
- Declined payment (bad PIN) → legs EXPIRED + seats released within ~5s
  (verify via inventory seats endpoint).

---

## 9. Phase 5 — Frontend

All files under `busgo/frontend/src/`. Run `node_modules/.bin/tsc --noEmit`
after each file; it must stay clean.

### 9.1 `pages/SearchResults.tsx`
- After the existing direct-search call, ALSO call
  `GET /api/transit/search?origin=&destination=&journey_date=`.
- If direct results exist: render them first, then a section
  **“Connecting journeys (change buses)”** with multi-leg itineraries
  (`leg_count > 1` only, to avoid duplicating directs).
- If NO direct results: show the itineraries as the main results with a banner
  “No direct bus — here are connecting options”.
- Itinerary card shows each leg (operator, times, fare) and between legs a
  transfer chip: “Change at {city} · wait {wait_minutes} min”.
- “Book journey” navigates to `/booking/transit-seats` with
  `state = { itinerary, origin, destination, date }`.

### 9.2 NEW `pages/TransitSeats.tsx` (route `/booking/transit-seats`)
A stepper with one step per leg:
- For each leg fetch `GET /api/inventory/trips/{trip_id}/seats` and reuse the
  seat-grid interaction pattern from `SelectSeats.tsx` (copy the grid JSX; do
  not refactor SelectSeats).
- Same number of seats must be selected on every leg (= passenger count,
  chosen on step 1).
- Final step → navigate to `/booking/transit-passengers` with all selections.

### 9.3 NEW `pages/TransitPassengerDetails.tsx` (route `/booking/transit-passengers`)
Copy the contact-form skeleton from `PassengerDetails.tsx`. On submit build
`JourneyCreate` (legs from the itinerary + chosen seats; `fare = leg.fare_amount
* seats.length`; `total_fare = sum`; `idempotency_key = crypto.randomUUID()`),
`POST /api/bookings/journeys/`, then navigate to
`/booking/payment/{first_booking_id}` with
`state = { journeyId, journeyTotal, legs, isTransit: true }`.

### 9.4 `pages/Payment.tsx`
Add a transit mode alongside the existing round-trip mode:
- If `state.isTransit`: total = journey `final_fare` (fetch
  `GET /api/bookings/journeys/{journeyId}` on mount to be authoritative);
  order summary lists each leg + transfer chips; promo input hits the journey
  promo path only if implemented — **for v1 hide the promo box in transit mode**
  (promo can be passed at journey creation instead).
- Pay: `POST /api/payments/initiate` with `{ journey_id: journeyId, booking_id:
  <first leg booking id>, trip_id: <first leg trip_id>, amount, method, … }`
  then `POST /api/bookings/journeys/{journeyId}/confirm-payment?payment_id=…`,
  then navigate to the existing confirmation page with `state.isTransit` so it
  can render all legs/tickets.
- On definitive failure statuses (402/403/5xx) show “seats released” and
  redirect home (mirrors existing behavior).

### 9.5 `pages/MyBookings.tsx`
Group rows that share `journey_id`: render one “Journey {origin} → {destination}
(via {transfer cities})” card containing its legs, using leg data already
returned by `/api/bookings/my` (add `journey_id`/`leg_number` to
`BookingResponse` in booking-service `schemas/schemas.py` — two optional fields).

### 9.6 Router wiring
Add the two new routes in `App.tsx` next to the existing `/booking/*` routes.

---

## 10. Phase 6 — Seed connecting trips (needed to demo)

The dataset has Dhaka/Comilla/Sylhet. Ensure at least one **connectable pair**
exists on the demo date, e.g. Dhaka→Comilla 08:00–11:00 and Comilla→Sylhet
13:00–18:00 on the same date. Create via operator portal UI, or API:
`POST /api/operators/trips/` (needs an operator JWT + existing bus_id/route_id —
list them via `GET /api/operators/operators/{id}/buses` and `/routes`; create a
Comilla→Sylhet route first if none exists). Then **re-run**
`curl -X POST http://localhost:18085/api/search/reindex` so both search and
transit see the new trips.

---

## 11. Phase 7 — Tests & docs

1. `busgo/tests/run_tests.py` — add `cmd_transit(_args)` (wire into argparse +
   `all`):
   - discover two connectable trips via `/api/transit/search` (skip with WARN
     if none seeded);
   - assert every returned itinerary chains correctly: `legs[i].destination_city
     == legs[i+1].origin_city` and transfer wait ∈ [30 min, 6 h];
   - saga compensation test: lock a seat on leg-2's trip directly via
     inventory with a random booking_id, then POST a journey needing that seat
     → expect 409 AND leg-1 seats AVAILABLE afterwards; then release the
     manual lock.
2. `busgo/tests/curl_commands.md` — add a “transit-service `/api/transit`”
   section (search curl) and a journey-booking example under booking-service.
3. **Testing recipe (JWTs):** mint tokens inside any service container:
   ```bash
   docker exec infrastructure-booking-service-1 python -c "
   from jose import jwt; from datetime import datetime,timedelta,timezone
   print(jwt.encode({'user_id':'<uuid>','sub':'<uuid>','role':'CUSTOMER',
     'exp':datetime.now(timezone.utc)+timedelta(hours=1)},'supersecretkey',algorithm='HS256'))"
   ```
4. Update `busgo/tests/config.json` (done in Phase 2) and re-run
   `python run_tests.py all` → must be green.

---

## 12. End-to-end demo script (the thing to show the teacher)

```bash
# 1. No direct bus Dhaka→Sylhet on the date; transit finds a 2-leg itinerary
curl -s "http://localhost:18085/api/transit/search?origin=Dhaka&destination=Sylhet&journey_date=2026-07-10" | jq

# 2. In the UI: search Dhaka→Sylhet → connecting-journey card with
#    "Change at Comilla · wait 120 min" → pick seats on BOTH buses →
#    one payment → two tickets (one per bus).

# 3. Saga compensation: make leg-2's seat taken, book again → 409 and leg-1
#    seats instantly released (watch inventory seats endpoint).

# 4. Microservice story: transit-service is a separate container/upstream in
#    Kong; kill it -> direct search still works (graceful degradation);
#    Grafana shows its own request rate/latency series.
```

---

## 13. Execution order & definition of done

| # | Phase | Blocks | Done when |
|---|---|---|---|
| 1 | transit-service code | — | §5.7 criteria pass |
| 2 | infra wiring | 1 | §6.5 commands pass, unit suite green |
| 3 | booking saga | — (parallel with 1) | §7.4 criteria pass |
| 4 | payment journey support | 3 | §8.4 criteria pass |
| 5 | frontend | 1–4 | tsc clean; UI flow books a 2-leg journey |
| 6 | seed data | 2 | transit search returns ≥1 two-leg itinerary |
| 7 | tests & docs | all | `python run_tests.py all` green incl. transit |

**Non-goals for v1 (explicitly out of scope, do not build):** cross-date
multi-day itineraries beyond the +6h window, per-leg different passenger lists,
partial-journey cancellation (cancel is whole-journey only), promo UI on the
transit payment page, walking/other transport between terminals in the same city.
```
