🗂️ First — paste this as the MASTER CONTEXT prompt:
I am building a microservices-based online bus ticket booking platform 
called "BusGo" for Bangladesh, similar to Shohoz. 

Tech stack decisions:
- Frontend: React (Vite + TypeScript + TailwindCSS + React Query + Zustand)
- Backend: FastAPI (Python) — one FastAPI app per microservice
- Database: PostgreSQL (per service via SQLAlchemy + Alembic migrations)
- Cache: Redis (via redis-py)
- Search: Elasticsearch (via elasticsearch-py)
- Message Broker: Apache Kafka (via aiokafka)
- Container: Docker + Docker Compose for local dev
- API Gateway: Kong (config via YAML)
- Auth: JWT (python-jose) + OAuth2
- File Storage: AWS S3 (boto3)
- ORM: SQLAlchemy (async) with Pydantic v2 for schemas

Monorepo structure:
busgo/
├── frontend/                  (React app)
├── services/
│   ├── auth-service/          (FastAPI)
│   ├── search-service/        (FastAPI)
│   ├── inventory-service/     (FastAPI)
│   ├── booking-service/       (FastAPI)
│   ├── payment-service/       (FastAPI)
│   ├── ticket-service/        (FastAPI)
│   ├── notification-service/  (FastAPI)
│   ├── cancellation-service/  (FastAPI)
│   ├── operator-service/      (FastAPI)
│   ├── deals-service/         (FastAPI)
│   ├── admin-service/         (FastAPI)
│   └── audit-service/         (FastAPI)
├── infrastructure/
│   ├── docker-compose.yml
│   ├── kong/
│   ├── kafka/
│   └── postgres/
└── shared/
    ├── kafka_utils/
    ├── base_model/
    └── exceptions/

Each service runs on its own port:
- auth-service:        8001
- search-service:      8002
- inventory-service:   8003
- booking-service:     8004
- payment-service:     8005
- ticket-service:      8006
- notification-service:8007
- cancellation-service:8008
- operator-service:    8009
- deals-service:       8010
- admin-service:       8011
- audit-service:       8012
- frontend (Vite):     5173
- Kong Gateway:        8000

All services communicate through Kong API Gateway 
(port 8000) from the frontend.
Inter-service async communication via Kafka.
Direct sync calls only where noted.

🔧 Phase 1 — Infrastructure Setup:
Set up the base infrastructure for the BusGo monorepo.

1. Create docker-compose.yml in /infrastructure/ that spins up:
   - PostgreSQL 16 (one instance, multiple databases: 
     auth_db, booking_db, payment_db, inventory_db, 
     operator_db, cancellation_db, deals_db, audit_db)
   - Redis 7 (single instance, multiple logical DBs)
   - Elasticsearch 8.x (single node for dev)
   - Apache Kafka + Zookeeper (single broker for dev)
   - Kafdrop (Kafka UI for dev, port 9000)
   - Kong Gateway + Konga UI
   - All FastAPI microservices (built from their Dockerfiles)
   - React frontend (Vite dev server)

2. Create a shared /shared/ Python package with:
   - base_response.py: Standard API response wrapper
     { success: bool, data: any, message: str, errors: list }
   - kafka_producer.py: Async Kafka producer utility
     with publish(topic: str, event: dict) method
   - kafka_consumer.py: Async Kafka consumer base class
   - exceptions.py: Custom exceptions 
     (BookingNotFound, SeatAlreadyLocked, 
      PaymentFailed, UnauthorizedAccess)
   - enums.py: 
     BookingStatus(INITIATED, SEAT_LOCKED, PAYMENT_PENDING, 
                   CONFIRMED, CANCELLED, REFUNDED, EXPIRED)
     PaymentMethod(BKASH, NAGAD, CARD, INTERNET_BANKING)
     UserRole(CUSTOMER, OPERATOR, ADMIN)
     TicketStatus(ACTIVE, USED, CANCELLED, EXPIRED)

3. Create Kafka topics init script:
   Topics: booking.created, payment.completed, seat.locked,
   seat.lock.expired, ticket.issued, booking.cancelled,
   refund.initiated, notification.send, audit.log

4. Create base FastAPI template for each service with:
   - main.py (FastAPI app, CORS, lifespan events)
   - database.py (async SQLAlchemy engine + session)
   - Dockerfile (python:3.12-slim, uvicorn)
   - requirements.txt
   - .env.example
   - /routers/, /models/, /schemas/, /services/ folders

🔐 Phase 2 — Auth Service:
Build the Auth Service for BusGo at /services/auth-service/

Models (PostgreSQL via SQLAlchemy async):
- User: id(UUID), phone(str, unique), email(str, nullable), 
  full_name(str), password_hash(str), role(UserRole enum),
  is_verified(bool), is_active(bool), 
  created_at, updated_at

- OTPRecord: id, phone, otp_code(6-digit), 
  expires_at(5 min TTL), is_used(bool)

- RefreshToken: id, user_id(FK), token(str), 
  expires_at, is_revoked(bool)

Endpoints:
POST /auth/register
  - Body: { phone, full_name, password, email? }
  - Sends OTP to phone via SMS
  - Returns: { message: "OTP sent" }

POST /auth/verify-otp
  - Body: { phone, otp_code }
  - Marks user as verified
  - Returns: { access_token, refresh_token, user }

POST /auth/login
  - Body: { phone, password }
  - Returns: { access_token(15min), refresh_token(7days), user }

POST /auth/refresh
  - Body: { refresh_token }
  - Rotates refresh token
  - Returns: { access_token, refresh_token }

POST /auth/logout
  - Revokes refresh token

GET /auth/me
  - Returns current user profile

POST /auth/send-otp
  - Sends OTP for phone verification

POST /auth/google-login
  - OAuth2 Google token verification
  - Returns: { access_token, refresh_token, user }

JWT Implementation:
- Access token: 15 minutes, contains { user_id, role, phone }
- Refresh token: 7 days, stored in DB
- Use python-jose for JWT
- Passwords hashed with bcrypt

OTP Service:
- Generate 6-digit OTP
- Store in Redis with 5-minute TTL
- Mock SMS send (print to console in dev, 
  integrate BSMS API endpoint in prod)

Middleware:
- get_current_user() dependency: 
  validates JWT, returns user object
- require_role(role: UserRole) dependency: 
  role-based access control

Publish Kafka event on registration:
- Topic: audit.log
- Payload: { event: "user.registered", user_id, phone, timestamp }

🗺️ Phase 3 — Operator Service:
Build the Operator Service at /services/operator-service/

Models:
- Operator: id(UUID), name, contact_phone, 
  contact_email, address, license_no,
  commission_rate(float, default 10%),
  is_active(bool), created_at

- Bus: id(UUID), operator_id(FK), 
  registration_no(unique), bus_type(AC/NON_AC/SLEEPER),
  total_seats(int), seat_layout(JSON - defines seat grid),
  amenities(JSON - wifi, charging, etc.), is_active(bool)

- Route: id(UUID), operator_id(FK),
  origin_city(str), destination_city(str),
  distance_km(float), estimated_duration_hours(float),
  boarding_points(JSON array of {name, address, lat, lng}),
  dropping_points(JSON array)

- Trip: id(UUID), operator_id(FK), bus_id(FK), route_id(FK),
  departure_datetime, arrival_datetime,
  fare_amount(decimal), available_seats(int),
  status(SCHEDULED/CANCELLED/COMPLETED),
  created_at

Endpoints:
POST /operators/register (Admin only)
GET /operators/{id}
GET /operators/ (list, paginated)
PUT /operators/{id}

POST /operators/{id}/buses
GET /operators/{id}/buses
PUT /buses/{id}

POST /operators/{id}/routes
GET /operators/{id}/routes
GET /routes/ (list all, filter by origin+destination)

POST /trips/ (Operator creates trip)
GET /trips/{id}
GET /trips/ (filter: origin, destination, date, operator_id)
PUT /trips/{id}
POST /trips/{id}/cancel (triggers bulk refund event)

On trip cancellation:
Publish Kafka event:
- Topic: booking.cancelled (with trip_id for bulk processing)
- Topic: audit.log

🪑 Phase 4 — Inventory & Seat Management Service:
Build Inventory Service at /services/inventory-service/

Models:
- SeatInventory: id(UUID), trip_id(UUID), 
  seat_number(str e.g. "A1","A2"), 
  seat_type(WINDOW/AISLE/SLEEPER_UPPER/SLEEPER_LOWER),
  status(AVAILABLE/LOCKED/BOOKED),
  locked_by_booking_id(UUID nullable),
  lock_expires_at(datetime nullable),
  booked_by_user_id(UUID nullable)

Redis seat lock key format:
  "seat_lock:{trip_id}:{seat_number}" → booking_id
  TTL = 600 seconds (10 minutes)

Endpoints:
GET /inventory/trips/{trip_id}/seats
  - Returns full seat map with statuses
  - Checks Redis for active locks and merges with DB status

POST /inventory/trips/{trip_id}/seats/lock
  - Body: { seat_numbers: ["A1","A2"], booking_id, user_id }
  - Sets Redis lock for each seat (TTL 10 min)
  - Returns: { locked: ["A1","A2"], expires_at }
  - If seat already locked: raises SeatAlreadyLocked

POST /inventory/trips/{trip_id}/seats/release
  - Body: { seat_numbers: ["A1"], booking_id }
  - Removes Redis lock
  - Used on cancellation or lock expiry

POST /inventory/trips/{trip_id}/seats/confirm
  - Body: { seat_numbers: ["A1"], booking_id, user_id }
  - Moves seat status from LOCKED to BOOKED in DB
  - Removes Redis lock
  - Called by Booking Service after payment confirmed

Kafka Consumer:
- Listen to: seat.lock.expired
  → Call release endpoint internally

- Listen to: booking.cancelled
  → Release all seats for that booking_id

GET /inventory/trips/{trip_id}/available-count
  - Returns count of available seats (for search results)

Initialize seat inventory:
POST /inventory/trips/{trip_id}/initialize
  - Called by Operator Service when trip is created
  - Generates seat records based on bus seat_layout JSON

🎟️ Phase 5 — Search Service:
Build Search Service at /services/search-service/

This service indexes trip data from Operator Service 
into Elasticsearch for fast searching.

Elasticsearch Index: "bus_trips"
Fields: trip_id, operator_id, operator_name, bus_type,
origin_city, destination_city, departure_datetime, 
arrival_datetime, fare_amount, available_seats,
boarding_points, amenities, status

Endpoints:
GET /search/buses
  Query params:
  - origin (required)
  - destination (required)  
  - journey_date (required, format: YYYY-MM-DD)
  - seat_class (optional: AC/NON_AC/SLEEPER)
  - min_price (optional)
  - max_price (optional)
  - departure_time_range (optional: MORNING/AFTERNOON/NIGHT)
  - sort_by (optional: price/departure_time/duration)
  - page, page_size
  
  Flow:
  1. Check Redis cache key: 
     "search:{origin}:{destination}:{date}"
  2. If cache hit → return cached results
  3. If cache miss → query Elasticsearch
  4. Cache result in Redis (TTL: 5 minutes)
  5. For each trip, call Inventory Service (sync HTTP) 
     to get real-time available_seats count
  6. Return merged results

  Circuit Breaker:
  - If Inventory Service is down (3 failures in 30s)
  → Return search results with available_seats 
    from Elasticsearch index (stale but graceful)
  → Add response header: X-Inventory-Status: degraded

GET /search/cities
  - Returns list of all origin/destination cities
  - Cached in Redis (TTL: 1 hour)

GET /search/buses/{trip_id}
  - Returns detailed trip info
  - Always fetches fresh from Inventory Service

Kafka Consumer:
- Listen to: trip.created, trip.updated, trip.cancelled
  → Re-index in Elasticsearch

Implement Circuit Breaker using tenacity library:
- @retry(stop=stop_after_attempt(3), 
         wait=wait_exponential(min=1, max=10))

📋 Phase 6 — Booking Service:
Build Booking Service at /services/booking-service/

Models:
- Booking: id(UUID), user_id(UUID), trip_id(UUID),
  operator_id(UUID), 
  seat_numbers(JSON array),
  passenger_details(JSON: [{name, age, gender, seat}]),
  boarding_point(str), dropping_point(str),
  journey_date(date), departure_time(time),
  total_fare(decimal), discount_amount(decimal, default 0),
  promo_code(str nullable),
  status(BookingStatus enum),
  idempotency_key(str, unique),
  payment_id(UUID nullable),
  created_at, updated_at, expires_at

- BookingStatusHistory: id, booking_id(FK), 
  from_status, to_status, changed_at, reason(str)

Endpoints:
POST /bookings/
  - Body: {
      trip_id, seat_numbers, passenger_details,
      boarding_point, dropping_point,
      promo_code?, idempotency_key
    }
  - Check idempotency_key in Redis — if exists return cached response
  - Call Deals Service (sync) to validate promo_code
  - Call Inventory Service (sync) to lock seats
  - Create Booking record with status: SEAT_LOCKED
  - Store idempotency_key in Redis (TTL: 24hr)
  - Set booking expiry: now + 10 minutes
  - Publish Kafka: booking.created
  - Publish Kafka: audit.log
  - Returns: { booking_id, expires_at, total_fare }

GET /bookings/{booking_id}
  - Returns booking with current status

GET /bookings/my
  - Returns all bookings for current user (paginated)

POST /bookings/{booking_id}/confirm-payment
  - Called internally by Payment Service via Kafka consumer
  - Updates status: PAYMENT_PENDING → CONFIRMED
  - Publishes Kafka: ticket.issued trigger

POST /bookings/{booking_id}/cancel
  - Validates cancellation eligibility
  - Updates status → CANCELLED
  - Publishes Kafka: booking.cancelled

Kafka Consumers:
- Listen to: payment.completed
  → Update booking status to CONFIRMED
  → Publish: ticket.issued

- Listen to: seat.lock.expired (from Redis TTL via Kafka)
  → Set booking status to EXPIRED
  → Publish: audit.log

Booking expiry background task:
- APScheduler job every 1 minute:
  → Find all bookings with status=SEAT_LOCKED 
    and expires_at < now
  → Set status to EXPIRED
  → Publish Kafka: seat.lock.expired for each

💳 Phase 7 — Payment Service:
Build Payment Service at /services/payment-service/

Models:
- Payment: id(UUID), booking_id(UUID), user_id(UUID),
  amount(decimal), method(PaymentMethod enum),
  gateway_transaction_id(str nullable),
  status(PENDING/COMPLETED/FAILED/REFUNDED),
  gateway_response(JSON),
  initiated_at, completed_at

- Refund: id(UUID), payment_id(FK), booking_id(UUID),
  amount(decimal), reason(str),
  status(PENDING/PROCESSING/COMPLETED/FAILED),
  gateway_refund_id(str nullable),
  initiated_at, completed_at,
  estimated_days(int)

Endpoints:
POST /payments/initiate
  - Body: { booking_id, method: BKASH|NAGAD|CARD|NET_BANKING }
  - Create Payment record (status: PENDING)
  - Update booking status: PAYMENT_PENDING
  - Return gateway redirect URL based on method:
    BKASH: mock bKash payment URL
    NAGAD: mock Nagad payment URL  
    CARD/NET_BANKING: SSLCOMMERZ checkout URL
  - Return: { payment_id, redirect_url }

POST /payments/bkash/callback
  - Handles bKash async webhook
  - Verifies signature (mock in dev)
  - If success → update Payment status: COMPLETED
  - Publish Kafka: payment.completed
  - Publish Kafka: audit.log

POST /payments/nagad/callback (same pattern)
POST /payments/sslcommerz/callback (same pattern)

GET /payments/{payment_id}
GET /payments/booking/{booking_id}

POST /payments/{payment_id}/refund
  - Called by Cancellation Service
  - Create Refund record
  - Call gateway refund API (mock in dev)
  - Set estimated_days based on method:
    BKASH/NAGAD: 5-7 days
    CARD/NET_BANKING: 7-10 days
  - Publish Kafka: refund.initiated
  - Publish Kafka: audit.log

Fraud Detection Module:
- Check: same user, same trip, multiple payment attempts > 3
- Check: payment amount mismatch with booking fare
- If fraud detected: reject and publish audit.log event

Kafka Consumer:
- Listen to: booking.cancelled
  → Auto-trigger refund if payment was COMPLETED

Mock gateway implementations (dev):
- All gateways return success after 2 second delay
- Include /payments/mock/simulate-failure endpoint 
  for testing failure scenarios

🎫 Phase 8 — Ticket Service:
Build Ticket Service at /services/ticket-service/

Models:
- Ticket: id(UUID), booking_id(UUID), user_id(UUID),
  trip_id(UUID), seat_numbers(JSON),
  passenger_details(JSON),
  qr_code_data(str - unique token),
  qr_code_url(str - S3 URL),
  pdf_url(str - S3 URL),
  status(TicketStatus enum),
  issued_at, used_at, expires_at

Endpoints:
GET /tickets/{ticket_id}
GET /tickets/booking/{booking_id}
GET /tickets/my (all tickets for current user)

POST /tickets/validate-qr
  - Body: { qr_code_data }
  - Used by bus conductor at boarding
  - Validates QR is ACTIVE and trip hasn't departed yet
  - Updates status to USED
  - Returns: { valid: bool, passenger_details, seat_numbers }

Kafka Consumer:
- Listen to: payment.completed (via booking.confirmed path)
  Listen to: ticket.issued
  → Fetch booking details (sync HTTP to Booking Service)
  → Generate unique QR token (UUID + HMAC signature)
  → Generate QR code image using qrcode library
  → Generate PDF ticket using reportlab:
     - Include: passenger name, seat, boarding point,
       departure time, operator name, booking ID, QR code
  → Upload QR image + PDF to AWS S3 (mock with local 
    MinIO in dev)
  → Save Ticket record with S3 URLs
  → Publish Kafka: notification.send 
    (with ticket PDF URL for email)
  → Publish Kafka: audit.log

PDF Template contents:
- BusGo logo header
- Booking reference number (large, bold)
- Passenger name, seat number(s)
- Route: Origin → Destination
- Departure date and time
- Boarding point, dropping point
- Operator name and bus type
- QR code (large, centered)
- Footer: "Valid for single journey only"

S3 keys:
- QR: tickets/qr/{booking_id}.png
- PDF: tickets/pdf/{booking_id}.pdf

❌ Phase 9 — Cancellation Service:
Build Cancellation Service at /services/cancellation-service/

Models:
- CancellationRequest: id(UUID), booking_id(UUID), 
  user_id(UUID), reason(str),
  requested_at, 
  status(PENDING/APPROVED/REJECTED),
  rejection_reason(str nullable),
  refund_amount(decimal nullable),
  processed_at

Cancellation Policy:
- Must request at least 12 hours before departure
  (configurable per operator, default 12 hours)
- Requests blocked between 11 PM - 7 AM
- Operator-initiated cancellation bypasses these rules

Refund Calculation:
- Cancelled > 24hrs before departure: 90% refund
- Cancelled 12-24hrs before departure: 75% refund
- Cancelled < 12hrs: no refund (rejected)

Endpoints:
POST /cancellations/
  - Body: { booking_id, reason }
  - Fetch booking details (sync HTTP to Booking Service)
  - Check eligibility:
    → Booking must be CONFIRMED status
    → Current time must be outside 11PM-7AM window
    → Must be 12+ hours before departure
    → Must be the booking owner
  - If ineligible: return 400 with reason
  - Calculate refund amount
  - Create CancellationRequest record
  - Publish Kafka: booking.cancelled
    { booking_id, user_id, refund_amount, reason }
  - Publish Kafka: audit.log
  - Returns: { cancellation_id, refund_amount, estimated_days }

GET /cancellations/{id}
GET /cancellations/booking/{booking_id}

POST /cancellations/operator-cancel
  - Admin/Operator only
  - Body: { trip_id, reason }
  - Fetch ALL confirmed bookings for trip 
    (sync HTTP to Booking Service)
  - For each booking: initiate individual cancellation
    with 100% refund
  - Bulk publish Kafka: booking.cancelled events
  - Returns: { affected_bookings: int }

Kafka Consumer:
- Listen to: refund.initiated (from Payment Service)
  → Update CancellationRequest status to APPROVED
  → Publish: notification.send (cancellation confirmed)

🔔 Phase 10 — Notification Service:
Build Notification Service at /services/notification-service/

This service is purely event-driven — no REST endpoints 
except health check.

Models:
- NotificationLog: id(UUID), user_id(UUID), 
  channel(SMS/EMAIL/PUSH/WHATSAPP),
  template_name(str), payload(JSON),
  status(SENT/FAILED/PENDING),
  sent_at, error_message(str nullable)

Kafka Consumer (listen to: notification.send):
Event payload format:
{ 
  user_id, phone, email, fcm_token?,
  template: "booking_confirmed" | "booking_cancelled" | 
            "otp_verification" | "departure_reminder" |
            "refund_initiated" | "ticket_issued",
  data: { ...template variables }
}

Templates:
- booking_confirmed: 
  SMS: "BusGo: Booking confirmed! Ref: {booking_id}. 
        {origin}→{dest} on {date}. Seat: {seats}"
  Email: Full HTML with ticket attachment link
  
- booking_cancelled:
  SMS: "BusGo: Booking {booking_id} cancelled. 
        Refund of {amount} BDT initiated."
        
- departure_reminder:
  SMS: "BusGo Reminder: Your bus departs in 2 hours. 
        Boarding at {boarding_point}"
  Push: "Your bus departs in 2 hours! 🚌"

- ticket_issued:
  Email: HTML email with PDF ticket link (S3 URL)
  WhatsApp: "Your e-ticket is ready: {pdf_url}"

Channel Handlers:
1. SMS Handler: 
   - Mock: print to console + save to NotificationLog
   - Prod: HTTP call to BSMS API

2. Email Handler:
   - Use sendgrid or smtplib
   - HTML email templates with Jinja2
   - Mock: save to /tmp/emails/ as HTML files

3. Push Handler:
   - Firebase Admin SDK
   - Mock: print to console

4. WhatsApp Handler:
   - WhatsApp Business API HTTP call
   - Mock: print to console

Departure Reminder Scheduler:
- APScheduler job every 30 minutes
- Query Booking Service for trips departing in 2 hours
- Publish notification.send for each booking

🏷️ Phase 11 — Deals Service:
Build Deals Service at /services/deals-service/

Models:
- PromoCode: id(UUID), code(str, unique), 
  discount_type(PERCENTAGE/FLAT),
  discount_value(decimal),
  min_fare(decimal, default 0),
  max_discount(decimal nullable),
  valid_from(datetime), valid_until(datetime),
  max_uses(int), current_uses(int, default 0),
  applicable_operators(JSON array, empty = all),
  is_active(bool)

- FlashSale: id(UUID), name(str),
  discount_percentage(int),
  start_time(datetime), end_time(datetime),
  applicable_trips(JSON array, empty = all),
  is_active(bool)

Endpoints:
POST /deals/validate-promo
  - Body: { code, trip_id, fare_amount, user_id }
  - Check: code exists, is_active, within valid dates
  - Check: current_uses < max_uses
  - Check: fare_amount >= min_fare
  - Check: operator is applicable
  - Check: user hasn't used this code before (Redis set)
  - Calculate discount:
    PERCENTAGE: min(fare * rate, max_discount)
    FLAT: min(discount_value, fare_amount)
  - Return: { valid: bool, discount_amount, final_fare }
  - Does NOT consume the code (just validates)

POST /deals/apply-promo
  - Called by Booking Service after successful booking
  - Increments current_uses in DB
  - Adds user_id to Redis set: "promo_used:{code}"

GET /deals/flash-sales/active
  - Returns currently active flash sales

GET /deals/promos/ (Admin only — list all promos)
POST /deals/promos/ (Admin only — create promo)
PUT /deals/promos/{id} (Admin only)
DELETE /deals/promos/{id} (Admin only)

📊 Phase 12 — Admin & Audit Services:
Build Admin Service at /services/admin-service/

All endpoints require role: ADMIN

Endpoints:
GET /admin/dashboard
  - Returns: {
      total_bookings_today, total_revenue_today,
      active_trips_today, cancellations_today,
      top_routes (list of 5), 
      bookings_by_status (pie chart data)
    }
  - Aggregates from read replicas of all service DBs

GET /admin/bookings 
  (filter: date_range, status, operator_id, paginated)
GET /admin/revenue
  (filter: date_range, group_by: day/week/month)
GET /admin/operators (list with stats)
GET /admin/users (list, paginated, searchable)
GET /admin/support-tickets
POST /admin/support-tickets/{id}/resolve

---

Build Audit Service at /services/audit-service/

Models:
- AuditLog: id(UUID), event_type(str), 
  entity_type(str), entity_id(UUID),
  user_id(UUID nullable), operator_id(UUID nullable),
  payload(JSON), ip_address(str nullable),
  created_at (immutable — no updates ever)

Kafka Consumer (listen to: audit.log):
  → Create AuditLog record (append-only)
  → Never update or delete

GET /audit/logs (Admin only, paginated, filterable)
GET /audit/logs/booking/{booking_id}
GET /audit/logs/user/{user_id}

Index on: event_type, entity_id, user_id, created_at

⚛️ Phase 13 — React Frontend:
Build the React frontend for BusGo at /frontend/

Setup:
- Vite + TypeScript
- TailwindCSS + shadcn/ui components
- React Query (TanStack Query v5) for server state
- Zustand for client state (auth, booking flow)
- React Router v6
- Axios with interceptors (auto-attach JWT, refresh on 401)
- React Hook Form + Zod for form validation
- date-fns for date formatting

Folder structure:
frontend/src/
├── api/           (axios instances per service, all hit Kong :8000)
├── components/    (reusable UI components)
├── pages/         (route-level page components)
├── stores/        (Zustand stores)
├── hooks/         (custom React Query hooks)
├── types/         (TypeScript interfaces matching backend schemas)
└── utils/

Pages to build:

1. Home Page (/):
   - Hero section with search form
   - Search form fields: Origin (autocomplete from /search/cities),
     Destination (autocomplete), Journey Date (date picker),
     Trip Type (one-way/round trip toggle)
   - "Search Buses" button → navigates to /search
   - Stats section: 250M+ tickets, 10M+ users
   - How it works section (3 steps)

2. Search Results Page (/search):
   - Left sidebar: filters (price range slider, bus type 
     checkboxes AC/NON_AC/SLEEPER, departure time radio, 
     operator filter)
   - Right: List of TripCard components
   - TripCard shows: operator name, bus type, departure time,
     arrival time, duration, fare, available seats, 
     boarding points, "Select Seats" button
   - Loading skeleton while fetching
   - Empty state if no results
   - "Degraded mode" banner if inventory unavailable

3. Seat Selection Page (/booking/select-seats/:trip_id):
   - Render interactive seat map grid from inventory API
   - Color coding: 
     Green = Available, Red = Booked, 
     Yellow = Locked by others, Blue = Selected by user
   - Click to select/deselect available seats
   - Max seat selection based on trip config
   - Real-time seat count update
   - Sidebar: selected seats summary, fare calculation
   - "Continue" button → goes to passenger details

4. Passenger Details Page (/booking/passengers):
   - Form for each selected seat: 
     name, age, gender (pre-fills from user profile)
   - Boarding point selector (dropdown from trip data)
   - Dropping point selector
   - Promo code input with "Apply" button
     (validates via Deals Service, shows discount)
   - Order summary: base fare, discount, total
   - "Proceed to Payment" button
   - 10-minute countdown timer (seat lock expiry)
   - If timer expires: show modal "Session expired, 
     seats released" → redirect to search

5. Payment Page (/booking/payment/:booking_id):
   - Display order summary (read-only)
   - Payment method selector:
     Radio cards with icons: bKash, Nagad, 
     Visa/MasterCard, Internet Banking
   - For bKash/Nagad: show mock phone number input
   - For Card: show card number, expiry, CVV fields
   - "Pay Now" button with loading state
   - Countdown timer still visible
   - Redirects to /booking/confirmation on success
   - Shows retry option on failure

6. Booking Confirmation Page (/booking/confirmation/:booking_id):
   - Success animation (confetti or checkmark)
   - Booking reference number (large)
   - Trip details summary
   - "Download E-Ticket" button (opens S3 PDF URL)
   - "View QR Code" button (shows QR modal)
   - "Go to My Bookings" button

7. My Bookings Page (/my-bookings):
   - Tabs: Upcoming | Past | Cancelled
   - BookingCard per booking: route, date, seat, status badge
   - "Download Ticket" button for CONFIRMED bookings
   - "Cancel Booking" button for eligible bookings
     → confirmation modal with refund amount shown

8. Cancellation Flow (modal on My Bookings):
   - Shows cancellation eligibility check
   - Shows refund amount and estimated timeline
   - Confirm/Cancel buttons
   - Post-cancellation: status updated, notification shown

9. Login / Register Pages (/login, /register):
   - Phone number + password login
   - OTP verification step
   - Google OAuth button (mock in dev)
   - Registration: name, phone, email (optional), password

10. Operator Portal (/operator/*) — separate layout:
    - Login with operator credentials
    - Dashboard: today's trips, total bookings, revenue
    - Manage Trips: list, create, cancel trip
    - Seat availability view per trip
    - Earnings report

Global Components:
- Navbar: Logo, nav links, user avatar + dropdown,
  login/register buttons if not authenticated
- Protected route wrapper (redirects to /login if no JWT)
- Toast notifications (react-hot-toast)
- Global loading overlay
- Error boundary
- 404 page

Zustand Auth Store:
- State: { user, accessToken, refreshToken, isAuthenticated }
- Actions: login(), logout(), refreshToken()
- Persist to localStorage (encrypted with crypto-js)

Axios Interceptor:
- Request: attach Authorization: Bearer {token}
- Response 401: auto-call refresh token endpoint,
  retry original request once, 
  on second 401: logout and redirect to /login

Environment variables (.env):
VITE_API_BASE_URL=http://localhost:8000  (Kong Gateway)

🐳 Phase 14 — Final Docker & Kong Setup:
Finalize the BusGo project with full local dev setup.

1. Complete docker-compose.yml:
   - All 12 FastAPI services with health checks
   - All services depend_on: postgres, redis, kafka
   - Environment variables from .env files
   - Volume mounts for hot reload in dev
   - Network: busgo-network (bridge)

2. Kong Gateway configuration (kong/kong.yml):
   Services and routes for all 12 microservices:
   
   - Route /api/auth/* → auth-service:8001
   - Route /api/search/* → search-service:8002
   - Route /api/inventory/* → inventory-service:8003
   - Route /api/bookings/* → booking-service:8004
   - Route /api/payments/* → payment-service:8005
   - Route /api/tickets/* → ticket-service:8006
   - Route /api/notifications/* → (no external route)
   - Route /api/cancellations/* → cancellation-service:8008
   - Route /api/operators/* → operator-service:8009
   - Route /api/deals/* → deals-service:8010
   - Route /api/admin/* → admin-service:8011
   - Route /api/audit/* → audit-service:8012
   
   Kong plugins:
   - jwt plugin on all routes except /api/auth/login 
     and /api/auth/register
   - rate-limiting: 100 req/min per consumer
   - cors: allow http://localhost:5173
   - request-transformer: add X-Service-Name header

3. Create Makefile with commands:
   make up      → docker compose up -d
   make down    → docker compose down
   make logs    → docker compose logs -f
   make migrate → run alembic upgrade head in all services
   make seed    → seed test data (operators, trips, users)
   make test    → run pytest in all services

4. Seed data script (/infrastructure/seed.py):
   - Create 3 test operators (Hanif, Shyamoli, Green Line)
   - Create buses for each operator
   - Create routes: Dhaka→Chittagong, Dhaka→Sylhet, 
     Dhaka→Cox's Bazar
   - Create 5 trips for next 7 days for each route
   - Create test user: phone=01700000000, password=Test@123
   - Create test operator user
   - Create test admin user
   - Create 3 promo codes: FIRST10 (10% off), 
     FLAT50 (50 BDT off), SAVE20 (20% off)

5. README.md with:
   - Prerequisites (Docker, Node 20, Python 3.12)
   - Quick start: git clone → make up → make migrate 
     → make seed → open localhost:5173
   - Service URLs table
   - Test credentials
   - Architecture overview