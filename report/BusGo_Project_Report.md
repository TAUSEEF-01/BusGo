# CSE 4113 - Internet Programming Lab

# Project Report

## BusGo (repository: *Jaabo*)

*Team Name: **[FILL IN]***

### Submitted By

| Team Member | Student ID |
|---|---|
| Md. Tauseef - Ur - Rahman (`TAUSEEF-01`) | [FILL IN] |
| Tamzid Tariq (`Tamzid-Tariq`) | 2021511224 *(verify — inferred from commit e-mail `tamzid-2021511224@cs.du.ac.bd`)* |
| Farzana T. N. (`FarzanaTN`) | [FILL IN] |
| Amina Islam (`AminaIslam1912`) | [FILL IN] |

**28th Batch**
Department of Computer Science & Engineering
University of Dhaka

**Submitted On**
[Date]

---

## Project Links

> Every link below must be public and live at submission time. The report is evaluated against what these links actually show, not just the write-up.

| Item | URL |
|---|---|
| Public Git Repository | https://github.com/TAUSEEF-01/Jaabo |
| Deployed Application URL | https://busgo.farefin.com |
| API Docs (Swagger) — public link | https://busgo.farefin.com/api/auth/docs (per-service Swagger; full list in §3.3) |
| Demo Video | **[FILL IN]** |

**Access credentials for the deployed application** are listed in §6.4.

> **Verify before submission:** the Azure VM (`135.171.216.245`) hosting `busgo.farefin.com` must be running and the Docker Compose stack must be `up`. Section 6.3 gives the exact commands. Also confirm that the Elasticsearch index has been re-seeded (`POST /api/search/reindex`), otherwise bus search returns 500 — see §5.3, BUG-07.

---

## Table of Contents

1. [Introduction](#1-introduction)
   - 1.1 [Problem Definition & Context](#11-problem-definition--context)
   - 1.2 [Target Users & Use Cases](#12-target-users--use-cases)
   - 1.3 [Core Features](#13-core-features)
   - 1.4 [Tech Stack Overview](#14-tech-stack-overview)
2. [System Architecture](#2-system-architecture)
   - 2.1 [High-Level Architecture Diagram](#21-high-level-architecture-diagram)
   - 2.2 [Frontend Architecture](#22-frontend-architecture)
   - 2.3 [Backend Architecture](#23-backend-architecture)
   - 2.4 [Database Design](#24-database-design)
3. [API Documentation](#3-api-documentation)
   - 3.1 [API Design Overview](#31-api-design-overview)
   - 3.2 [Endpoint Reference](#32-endpoint-reference)
   - 3.3 [Swagger / Postman Collection Link](#33-swagger--postman-collection-link)
   - 3.4 [Sample Request & Response](#34-sample-request--response)
4. [Authentication & Security](#4-authentication--security)
   - 4.1 [Authentication Strategy](#41-authentication-strategy)
   - 4.2 [Authorization & Role Management](#42-authorization--role-management)
   - 4.3 [Security Measures](#43-security-measures)
   - 4.4 [Known Vulnerabilities & Mitigations](#44-known-vulnerabilities--mitigations)
5. [Testing & Quality Assurance](#5-testing--quality-assurance)
   - 5.1 [Testing Strategy](#51-testing-strategy)
   - 5.2 [Test Coverage Summary](#52-test-coverage-summary)
   - 5.3 [Bug Tracking & Resolution Log](#53-bug-tracking--resolution-log)
   - 5.4 [Sample Test Cases](#54-sample-test-cases)
6. [CI/CD & Deployment](#6-cicd--deployment)
   - 6.1 [Pipeline Overview](#61-pipeline-overview)
   - 6.2 [Environments](#62-environments)
   - 6.3 [Deployment Steps](#63-deployment-steps)
   - 6.4 [Hosting Platform & Live URL](#64-hosting-platform--live-url)
   - 6.5 [Monitoring & Logging](#65-monitoring--logging)
7. [Repository & Documentation Quality](#7-repository--documentation-quality)
   - 7.1 [Branching Strategy & Commit Conventions](#71-branching-strategy--commit-conventions)
   - 7.2 [README Completeness Checklist](#72-readme-completeness-checklist)
   - 7.3 [Code Organization / Folder Structure](#73-code-organization--folder-structure)
   - 7.4 [Local Setup Instructions](#74-local-setup-instructions)
8. [Evaluation & Reflection](#8-evaluation--reflection)
   - 8.1 [Web Performance & Core Web Vitals](#81-web-performance--core-web-vitals)
   - 8.2 [Challenges & Solutions](#82-challenges--solutions)
   - 8.3 [Limitations & Future Work](#83-limitations--future-work)
   - 8.4 [Lessons Learned](#84-lessons-learned)
   - 8.5 [Individual Responsibility](#85-individual-responsibility)
- [Appendix — Screenshots / UI Walkthrough](#appendix--screenshots--ui-walkthrough)

---

# 1. Introduction

## 1.1 Problem Definition & Context

Intercity bus travel is the backbone of long-distance transport in Bangladesh, but the ticketing experience around it is still largely offline and fragmented. A passenger who wants to travel from Dhaka to Sylhet typically has to:

- physically visit a counter, or call an operator, to learn what buses run and at what time;
- trust a hand-drawn seat chart that may already be stale by the time the money changes hands;
- pay in cash with no verifiable receipt, and no reliable path to a refund if the trip is cancelled;
- and, if no direct bus exists for their origin–destination pair, plan the *connecting* journey entirely by themselves — buy one ticket to an intermediate city, get off, and hope a seat is still free on the onward bus.

On the supply side, operators run their inventory on paper or spreadsheets. They cannot see live occupancy across their fleet, cannot re-market seats that are still empty a few hours before departure, and have no analytics on which routes actually earn.

**BusGo** is a full-stack, microservices-based bus ticketing platform built to close both gaps. It gives passengers a single place to search (including multi-leg *transit* journeys that no single operator sells end-to-end), pick an exact seat from a live seat map, pay through a simulated mobile-financial-service gateway, and receive a QR e-ticket. It gives operators a portal to manage buses, routes, trips, promotions and curated connecting routes, plus targeted re-marketing of unsold seats. It gives platform administrators oversight of users, operators, transactions and system-wide notices.

The engineering problem the project actually solves is harder than the product description suggests, and it is the reason the system is decomposed into services rather than built as one application:

1. **Seat inventory is a contended resource.** Two users clicking the same seat at the same instant must not both succeed. This demands an atomic, distributed lock with an expiry, not a database `UPDATE` guarded by application logic.
2. **A booking is a distributed transaction.** Creating a booking touches operator, inventory, deals, payment, bank, ticket and notification services. There is no single database transaction spanning them, so the flow is modelled as a **saga with compensation** — especially for multi-leg journeys, where locking leg 2 may fail after leg 1 is already held.
3. **Money must never be taken on client-supplied numbers.** Fares, operators, boarding points and discounts sent by the browser are re-validated server-side against the operator service before a payment is authorised.

## 1.2 Target Users & Use Cases

The platform has three first-class roles (`CUSTOMER`, `OPERATOR`, `ADMIN`) enforced end-to-end in the JWT and in every service.

### Passenger (`CUSTOMER`)

| # | Use case | Where it lives |
|---|---|---|
| UC-01 | Search direct buses between two cities on a date, with filters | `search-service` → Elasticsearch |
| UC-02 | Search **connecting (transit) journeys** when no direct bus exists | `transit-service` graph search |
| UC-03 | Browse routes, active deals and flash sales without logging in (guest browsing) | web + mobile |
| UC-04 | View a live seat map and select 1–4 seats | `inventory-service` |
| UC-05 | Enter per-seat passenger details and apply a promo code | `booking-service`, `deals-service` |
| UC-06 | Pay via bKash / Nagad / linked bank account within a 10-minute seat hold | `payment-service`, `bank-service` |
| UC-07 | Receive a QR + PDF e-ticket (one per leg for a transit journey) | `ticket-service` |
| UC-08 | View booking history grouped by journey, cancel, and get a refund | `booking-service`, `cancellation-service` |
| UC-09 | Receive in-app notifications (confirmation, reminder, delay, refund, offers) | `notification-service` |
| UC-10 | Manage profile, wallet balance and travel/payment summary | `auth-service`, `bank-service` |

### Bus Operator (`OPERATOR`)

| # | Use case | Where it lives |
|---|---|---|
| UC-11 | Register an operator profile and manage it | `operator-service` |
| UC-12 | CRUD buses (registration, type, seat layout, amenities) | `operator-service` |
| UC-13 | CRUD routes (origin/destination, distance, boarding & dropping points) | `operator-service` |
| UC-14 | Schedule, update and cancel trips | `operator-service` |
| UC-15 | Publish **curated transit routes** (e.g. Dhaka→Sylhet via Cumilla) with a combined discount | `operator-service` (`transit_routes`) |
| UC-16 | View bookings and passenger manifests per trip | `booking-service` |
| UC-17 | Issue operator-scoped promo codes and flash sales | `deals-service` |
| UC-18 | **Fill empty seats** — find past passengers on the same corridor and push a targeted offer | `booking-service` (`travel_records`) |
| UC-19 | Send notifications to interested/past passengers | `notification-service` |
| UC-20 | See revenue and occupancy analytics | operator portal + `admin`/`booking` data |

### Platform Administrator (`ADMIN`)

| # | Use case | Where it lives |
|---|---|---|
| UC-21 | Dashboard: users, operators, routes, trips, transaction totals | `admin-service` |
| UC-22 | Promote/demote user roles | `admin-service` |
| UC-23 | Publish platform-wide notices and broadcast notifications | `admin-service`, `notification-service` |
| UC-24 | Inspect the immutable audit trail of every booking/payment event | `audit-service` |
| UC-25 | Adjust simulated bank balances for demonstrations | `bank-service` |

## 1.3 Core Features

**Booking & travel**

- **City-aware search** over an Elasticsearch index of trips, with live seat availability merged in from `inventory-service` at query time.
- **Multi-leg transit journeys** — a dedicated `transit-service` performs a bounded graph search over the trip index (`MIN_TRANSFER_MINUTES=30`, `MAX_TRANSFER_WAIT_HOURS=6`, `MAX_LEGS=3`, top 5 itineraries). Operator-curated itineraries are badged and ranked above auto-discovered ones.
- **Live seat map with distributed locking** — a Redis `SET NX EX` lock per `(trip, seat)` with a 600-second TTL, overlaid on the persistent `seat_inventory` table, so exactly one of N concurrent users can win a contended seat.
- **All-or-nothing journey booking (saga)** — every leg of a transit journey is locked; if any leg fails, all previously locked legs are released as compensation, and the user is told no seats were held.
- **Server-side fare authority** — the booking service re-fetches the trip from `operator-service` and rejects the request if operator, status, boarding/dropping point or fare disagree with what the client sent.
- **Idempotent booking creation** — every create carries an `idempotency_key` that is both a unique DB column and a Redis cache key, so a retried request returns the original booking instead of double-booking.
- **10-minute seat hold** with a countdown in the UI and a background scheduler that expires stale holds and publishes `seat.lock.expired`.

**Payments**

- Simulated **bKash / Nagad / bank** gateways with a redirect+callback flow.
- A real (simulated) ledger in `bank-service`: accounts, PIN verification, balance checks, debits/credits and a transaction history — payments actually move money between rows rather than merely flipping a status.
- **Fraud checks** in `payment-service`: amount-vs-booking mismatch, a cap of 3 payment attempts per user per trip (which then definitively releases the seats), and idempotent retry handling that returns the original completed payment instead of debiting twice.
- **Refunds** with a policy-driven amount (80 % outside the 1-hour pre-departure window) and a `refund.initiated` event.

**Tickets & notifications**

- QR-coded, PDF-rendered e-tickets stored on a Docker volume; one ticket per leg of a journey.
- QR validation endpoint for counter/driver scanning.
- A notification domain with **26 typed notification kinds** scoped by role (customer / operator / admin), an in-app inbox with unread counts, plus mocked e-mail, SMS, push and WhatsApp channels driven by Kafka events.

**Operator & admin tooling**

- Full CRUD for operators, buses, routes, trips and curated transit routes.
- Operator-scoped promo codes and flash sales.
- **Fill Empty Seats**: `travel_records` remembers which corridors a user has travelled, so an operator can find and notify exactly the people likely to want a seat that is still empty.
- Admin dashboard, role management, notices, transaction summaries and an audit log.

**Platform engineering (deliberately part of the product)**

- **Kong API Gateway** with declarative config, upstreams, ring-balancer load balancing across replicas, active `/health` polling and passive circuit-breaking, plus request retries.
- **Kafka** event backbone with 9 published topics and ~30 consumed event types.
- **Prometheus + Grafana + Loki + Promtail** observability, with a shared instrumentation module giving every service `/metrics`, structured JSON logs and an `X-Request-ID` correlation ID that is propagated across inter-service HTTP calls.
- **Resilient inter-service HTTP client** with split timeouts, exponential-backoff retries and a per-host circuit breaker.
- **Three clients** against one API: a React web app, an Expo/React Native passenger app, and a separate Expo operator app.

## 1.4 Tech Stack Overview

### Frontend

| Choice | Why |
|---|---|
| **React 18 + TypeScript + Vite** (web) | Fast HMR dev loop and a typed component model; Vite's build produces a single static bundle that Nginx can serve. |
| **Tailwind CSS 4** | Utility-first styling kept the three portals (public, operator, admin) visually consistent without a component-library dependency. |
| **React Router v7** | Declarative nested routing with a `ProtectedRoute` wrapper that enforces role gates in the SPA. |
| **React Native 0.81 + Expo SDK 54** (mobile & operator apps) | One TypeScript codebase per app, distributable as an APK/Expo Go bundle, reusing the same Kong API. |
| **React Navigation v7** | Native stack + bottom tabs for the two mobile apps. |
| **Leaflet** | Map-based boarding/dropping point selection. |
| **`react-qr-code`, `jspdf`, `html2canvas`** | Client-side ticket rendering and PDF export. |

### State Management Solution

| Layer | Library | Role |
|---|---|---|
| **Client/session state** | **Zustand 5** (`persist` middleware) | `authStore` holds the user, access and refresh tokens; persisted to `localStorage` with a cookie fallback, and synchronised across browser tabs via a `storage` event listener. `notificationStore` holds the inbox, unread count and the 30-second polling timer. |
| **Server/cache state** | **TanStack React Query 5** | Fetching, caching and background refresh of trips, seats, bookings and deals. |
| **Form state** | **React Hook Form + Zod** (via `@hookform/resolvers`) | Typed, schema-validated forms (registration, passenger details, operator CRUD). |
| **Mobile** | React Context (`src/store/auth.tsx`, `src/store/notifications.tsx`) + `expo-secure-store` / AsyncStorage | Same session model, tokens kept in secure storage. |

*Redux was deliberately not used:* the app's genuinely global state is small (session + notifications), and Zustand delivered that with far less ceremony, while React Query already owns everything server-derived.

### Backend

| Choice | Why |
|---|---|
| **Python 3.12 + FastAPI** | Async I/O suits a service mesh dominated by network waits; Pydantic gives request/response validation and auto-generated OpenAPI docs for free. |
| **SQLAlchemy 2 (async, `asyncpg`)** | Typed ORM models with an async engine; a few read-heavy services use the sync engine where async bought nothing. |
| **Kong Gateway 3.4 (DB-less)** | Single public entrypoint, path-based routing to 14 services, load balancing, health checks and retries — declared in one version-controlled `kong.yml`. |
| **Apache Kafka 7.5 + Zookeeper** | Asynchronous, decoupled cross-service events (booking → payment → ticket → notification → audit) so a slow consumer never blocks a user request. |
| **Redis 7** | Atomic seat locks (`SET NX EX`), idempotency cache, and promo-usage tracking. |
| **Elasticsearch 8.11** | Full-text and structured trip search; also the graph substrate for transit itinerary discovery. |
| **`python-jose` + `bcrypt`** | HS256 JWT issuance/verification and password hashing. |
| **APScheduler** | Seat-hold expiry and scheduled departure reminders. |
| **`httpx` + `tenacity`** | The shared resilient client (retries, backoff, circuit breaker). |

### Database

| Choice | Why |
|---|---|
| **PostgreSQL 15** | Relational integrity for money-touching data, with `JSONB` where the shape is genuinely document-like (seat layouts, passenger details, amenities, event payloads). |
| **Database-per-service** | 13 logical databases (`auth_db`, `booking_db`, `inventory_db`, …) so services own their schema and cannot reach into each other's tables. Locally these are separate databases in one cluster (`init-multiple-databases.sh`); in the deployed environment they are schemas inside one Supabase Postgres instance. |
| **Supabase (managed Postgres + PgBouncer)** | Managed, always-on Postgres for the deployed stack, reached through the transaction-mode pooler on port 6543. |

### Hosting & Third-Party Services / Cloud Infrastructure

| Choice | Why |
|---|---|
| **Azure Linux VM (Ubuntu, `135.171.216.245`)** | Single host running the entire Docker Compose stack — 14 services plus Kong, Redis, Kafka, Elasticsearch and the observability stack. |
| **Nginx (system) + Certbot/Let's Encrypt** | TLS termination for `busgo.farefin.com`, reverse-proxying `/` to the frontend container (`:8083`) and `/api/` to Kong (`:8085`). |
| **Docker & Docker Compose** | Reproducible multi-service topology; source directories are bind-mounted so code changes need only a container restart. |
| **Supabase** | (a) managed **PostgreSQL**, (b) **Supabase Auth** as the Google OAuth identity provider. |
| **Google OAuth 2.0** | The sole interactive sign-in method on web and mobile. |
| **Prometheus / Grafana / Loki / Promtail** | Self-hosted metrics, dashboards and log aggregation, all in the same Compose file. |
| **Expo / EAS** | Mobile build and distribution (`Expo-Go-57.0.2.apk` is bundled for demo convenience). |

### Scale of the codebase

| Area | Approx. lines |
|---|---|
| Python (14 services + shared modules) | ~11,200 |
| TypeScript / TSX (web + mobile + operator apps) | ~26,800 |
| Infrastructure as code (Compose, Kong, Prometheus, Loki, Grafana, SQL) | ~1,300 |
| **Total commits on `main`** | **163** |

---

# 2. System Architecture

## 2.1 High-Level Architecture Diagram

### 2.1.1 Component / deployment view

```mermaid
graph TB
    subgraph Clients
        WEB["Web SPA<br/>React 18 + Vite<br/>(Nginx :8083)"]
        MOB["Passenger App<br/>Expo / React Native"]
        OPS["Operator App<br/>Expo / React Native"]
    end

    NGX["System Nginx + Certbot<br/>busgo.farefin.com :443"]
    KONG["Kong API Gateway 3.4 (DB-less)<br/>upstreams · ring balancer<br/>active+passive health checks · retries"]

    WEB --> NGX
    MOB --> NGX
    OPS --> NGX
    NGX -->|"/"| WEB
    NGX -->|"/api/*"| KONG

    subgraph Edge["Business services (FastAPI)"]
        AUTH["auth-service<br/>/api/auth"]
        SRCH["search-service<br/>/api/search"]
        TRAN["transit-service<br/>/api/transit"]
        INV["inventory-service<br/>/api/inventory"]
        BOOK["booking-service<br/>/api/bookings"]
        PAY["payment-service<br/>/api/payments"]
        BANK["bank-service<br/>/api/bank"]
        TKT["ticket-service<br/>/api/tickets"]
        CANC["cancellation-service<br/>/api/cancellations"]
        OPR["operator-service<br/>/api/operators"]
        DEAL["deals-service<br/>/api/deals"]
        NOTI["notification-service<br/>/api/notifications"]
        ADM["admin-service<br/>/api/admin"]
        AUD["audit-service<br/>/api/audit"]
    end

    KONG --> AUTH & SRCH & TRAN & INV & BOOK & PAY & BANK & TKT & CANC & OPR & DEAL & NOTI & ADM & AUD

    subgraph Data["Data & messaging"]
        PG[("PostgreSQL 15 / Supabase<br/>13 logical databases")]
        RDS[("Redis 7<br/>seat locks · idempotency")]
        ES[("Elasticsearch 8.11<br/>bus_trips index")]
        KFK{{"Kafka 7.5 + Zookeeper<br/>9 topics"}}
    end

    AUTH & INV & BOOK & PAY & BANK & TKT & CANC & OPR & DEAL & NOTI & ADM & AUD --> PG
    AUTH & INV & BOOK & SRCH & DEAL --> RDS
    SRCH & TRAN --> ES
    BOOK & PAY & TKT & CANC & NOTI & AUD & SRCH & BANK <--> KFK

    subgraph Obs["Observability"]
        PROM["Prometheus"]
        GRAF["Grafana"]
        LOKI["Loki"]
        PTL["Promtail"]
    end
    PROM -.scrape /metrics.-> Edge
    PROM -.scrape.-> KONG
    PTL -.docker logs.-> LOKI
    PROM --> GRAF
    LOKI --> GRAF

    SUPA["Supabase Auth<br/>Google OAuth 2.0"]
    WEB -.OAuth.-> SUPA
    MOB -.OAuth.-> SUPA
    AUTH -.verify session.-> SUPA
```

### 2.1.2 Booking flow — sequence diagram (single-leg, happy path)

```mermaid
sequenceDiagram
    autonumber
    actor U as Passenger (SPA)
    participant K as Kong
    participant S as search-service
    participant I as inventory-service
    participant B as booking-service
    participant O as operator-service
    participant D as deals-service
    participant P as payment-service
    participant BK as bank-service
    participant Q as Kafka
    participant T as ticket-service
    participant N as notification-service

    U->>K: GET /api/search/buses?origin&destination&date
    K->>S: forward
    S->>S: query Elasticsearch (bus_trips)
    S->>I: GET /trips/{id}/available-count (resilient client)
    S-->>U: trips + live availability

    U->>K: GET /api/inventory/trips/{id}/seats
    K->>I: forward
    I->>I: seat_inventory rows + Redis lock overlay
    I-->>U: live seat map

    U->>K: POST /api/bookings/ (seats, passengers, fare, idempotency_key)
    K->>B: forward (JWT verified in service)
    B->>B: Redis idempotency lookup
    B->>O: GET /trips/{id}  (authoritative fare, operator, points)
    B->>B: reject if client fare/operator/point mismatch
    B->>D: POST /validate-promo
    B->>I: POST /trips/{id}/seats/lock  (Redis SET NX EX 600s)
    I-->>B: locked (or 409 SeatAlreadyLocked)
    B->>B: INSERT booking (SEAT_LOCKED) + status history
    B->>Q: publish booking.created, audit.log
    B-->>U: booking_id, expires_at (10 min)

    U->>K: POST /api/payments/initiate (method, PIN)
    K->>P: forward
    P->>B: GET /bookings/{id} (fraud check: amount match)
    P->>P: attempts < 3 ? else publish payment.failed
    P->>BK: POST /verify-debit (balance + PIN)
    BK-->>P: debited, balance_after
    P->>Q: publish payment.completed
    P-->>U: redirect_url / success

    Q-->>B: payment.completed
    B->>I: POST /trips/{id}/seats/confirm
    B->>B: booking -> CONFIRMED
    B->>Q: publish ticket.issued
    Q-->>T: ticket.issued
    T->>T: generate QR + PDF
    Q-->>N: notification.send
    N->>N: persist in_app_notification (BOOKING_CONFIRMED)
    Q-->>N: audit.log -> audit-service persists event

    U->>K: GET /api/notifications/ (30s poll)
    K->>N: forward
    N-->>U: unread count + inbox
```

### 2.1.3 Transit journey saga — compensation flow

```mermaid
sequenceDiagram
    autonumber
    actor U as Passenger
    participant TR as transit-service
    participant B as booking-service
    participant I as inventory-service
    participant P as payment-service

    U->>TR: GET /api/transit/search?origin&destination&journey_date
    TR->>TR: graph search over ES bus_trips<br/>(30 min ≤ transfer ≤ 6 h, ≤ 3 legs)
    TR->>TR: merge operator-curated transit_routes (ranked first)
    TR-->>U: ≤5 itineraries (source = operator | auto)

    U->>B: POST /api/bookings/journeys/ (all legs, one idempotency_key)
    B->>B: INSERT journey (SEAT_LOCKED)
    loop for each leg (ordered)
        B->>I: lock seats for leg N
        alt lock succeeds
            I-->>B: OK -> INSERT booking row (journey_id, leg_number)
        else lock fails
            I-->>B: 409
            B->>I: COMPENSATE — release legs 1..N-1
            B->>B: journey -> FAILED
            B-->>U: 409 "no seats were held"
        end
    end
    B-->>U: journey_id, total_fare, expires_at

    U->>P: POST /api/payments/initiate (journey_id)
    P->>B: GET /journeys/{id} — fraud check on the JOURNEY total
    P-->>U: paid
    Note over B: one payment · one booking row per leg · one ticket per leg
```

## 2.2 Frontend Architecture

Three separate client applications consume the same Kong-fronted API.

### 2.2.1 Web SPA (`busgo/frontend`)

```
src/
├── main.tsx                 # React root, QueryClientProvider, Router, Toaster
├── App.tsx                  # Route table + ProtectedRoute role gate
├── layout/MainLayout.tsx    # Navbar (with NotificationBell), footer, <Outlet/>
├── pages/                   # 27 route-level screens
│   ├── Home.tsx  SearchResults.tsx  Routes.tsx  Deals.tsx
│   ├── SelectSeats.tsx  PassengerDetails.tsx  Payment.tsx  Confirmation.tsx
│   ├── TransitSeats.tsx  TransitPassengerDetails.tsx
│   ├── MyBookings.tsx  Cancellation.tsx  Profile.tsx
│   ├── Login.tsx  Register.tsx
│   ├── OperatorPortal.tsx  ManageTrips.tsx  OperatorBookings.tsx
│   │   OperatorDeals.tsx  OperatorAnalytics.tsx  OperatorTransitRoutes.tsx
│   │   OperatorNotifications.tsx  OperatorSendNotification.tsx  FillEmptySeats.tsx
│   └── AdminPortal.tsx  AdminNotifications.tsx  AdminNotificationPanel.tsx
├── components/              # CityCombobox, LocationSearch, MapSelectorModal
├── notifications/           # NotificationBell, NotificationCard, NotificationsPage,
│                            # notificationApi, notificationStore (self-contained feature module)
├── stores/authStore.ts      # Zustand + persist + cookie fallback + cross-tab sync
├── api/client.ts            # Axios instance: auth interceptor + refresh-queue interceptor
├── hooks/useCityOptions.ts  # shared city list
├── lib/                     # supabase.ts, googleAuth.ts
└── utils/cn.ts              # clsx + tailwind-merge class helper
```

**Component structure.** Page components own data fetching (React Query) and compose small presentational pieces. Cross-cutting UI — the notification bell, the city combobox, the Leaflet map picker — is factored into reusable components. The notifications feature is organised as a vertical slice (`api + store + components` in one folder), which kept a 6-file feature from leaking into four different top-level directories.

**Routing.** A single `<Routes>` tree in `App.tsx`. Public pages (`/`, `/search`, `/routes`, `/deals`, `/login`, `/register`, and seat selection) render inside `MainLayout`. Everything that touches personal data is wrapped in `<ProtectedRoute>`, which redirects unauthenticated users to `/login` while preserving the intended destination in router state, so the user lands back where they were after Google sign-in. Role-scoped portals mount as wildcard sub-routers:

```tsx
<Route path="/operator/*" element={
  <ProtectedRoute allowedRoles={["OPERATOR", "ADMIN"]}><OperatorPortal /></ProtectedRoute>} />
<Route path="/admin/*" element={
  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminPortal /></ProtectedRoute>} />
```

This is a *UX* gate, not a security boundary — every protected endpoint independently re-verifies the JWT and the role server-side (§4.2).

**State management.** Covered in §1.4. Two details worth calling out:

- **Token refresh is queued.** `api/client.ts` installs a response interceptor: on a `401` it refreshes once, parks every other in-flight request in a `failedQueue`, then replays them with the new token. Session endpoints (`/login`, `/refresh`, `/google-login`) are excluded so a genuine credential failure does not trigger a refresh loop. Crucially, the store only logs the user out when the refresh *itself* is rejected (400/401/403) — network errors and 5xx preserve the session so a flaky connection cannot evict a valid user.
- **Cross-tab consistency.** A `storage` event listener rehydrates the Zustand store when another tab writes new tokens, preventing one tab from stranding another on an expired token.

### 2.2.2 Passenger mobile app (`busgo/mobile`)

Expo SDK 54 / React Native 0.81 / React Navigation 7, with 16 screens (`HomeScreen`, `ResultsScreen`, `SeatsScreen`, `TransitSeatsScreen`, `PassengerScreen`, `PaymentScreen`, `ConfirmationScreen`, `TripsScreen`, `BookingDetailScreen`, `TicketDetailScreen`, `AlertsScreen`, `DealsScreen`, `RoutesScreen`, `ProfileScreen`, `LoginScreen`, `PhoneSetupScreen`). It is at feature parity with the web passenger experience (documented in `mobile/MOBILE_WEB_PARITY_AUDIT.md`), including guest browsing, transit journeys, seat holds, promo codes, QR/PDF tickets and notifications. Tokens live in `expo-secure-store`; Google OAuth returns through the `busgo://auth/callback` deep link.

### 2.2.3 Operator mobile app (`busgo/operator`)

A separate Expo app with 12 screens (`DashboardScreen`, `BusesScreen`, `RoutesScreen`, `TripsScreen`, `TransitRoutesScreen`, `BookingsScreen`, `DealsScreen`, `FillSeatsScreen`, `NotifyScreen`, `AnalyticsScreen`, `ManageScreen`, `LoginScreen`). Keeping it as a distinct binary means an operator's device never ships passenger checkout code, and the two apps can be released independently.

## 2.3 Backend Architecture

### 2.3.1 Service decomposition

Fourteen FastAPI services, each with its own database, Dockerfile, dependency set and Kong route. The split follows business capability, not entity CRUD:

| Service | Responsibility | Notable dependencies |
|---|---|---|
| `auth-service` | Registration, login, Google session exchange, JWT issue/refresh, OTP, profile | Supabase Auth, Redis |
| `search-service` | Trip search over Elasticsearch, city list, reindex | ES, `inventory-service`, Kafka (`trip.*`) |
| `transit-service` | Multi-leg itinerary graph search (stateless) | ES, `operator-service` |
| `inventory-service` | Seat inventory, distributed seat locks, confirm/release | Redis, Kafka |
| `booking-service` | Booking + journey lifecycle, saga orchestration, travel records | operator, deals, payment, bank, notification, auth services; Kafka |
| `payment-service` | Payment initiation, mock gateways, fraud checks, refunds | `bank-service`, `booking-service`, Kafka |
| `bank-service` | Simulated accounts, balances, PIN, debit/credit ledger | Kafka |
| `ticket-service` | QR + PDF ticket generation, QR validation | Kafka (`ticket.issued`), volume storage |
| `cancellation-service` | Cancellation requests, refund policy, operator-initiated cancellations | Kafka |
| `operator-service` | Operators, buses, routes, trips, curated transit routes | Kafka (`trip.*`) |
| `deals-service` | Promo codes, flash sales, validation and application | Redis |
| `notification-service` | Event→notification fan-out, in-app inbox, mocked email/SMS/push/WhatsApp, scheduler | Kafka, Jinja2 |
| `admin-service` | Platform dashboard, user roles, notices, transaction summaries | — |
| `audit-service` | Append-only audit log fed from `audit.log` events | Kafka |

### 2.3.2 Internal structure of a service

Services follow a consistent layered layout — a router (HTTP/controller) layer, a service layer for external calls and domain logic, an ORM model layer and Pydantic schemas:

```
services/<name>/
├── main.py             # FastAPI app, CORS, observability, health router, startup hooks
├── core/config.py      # pydantic-settings, env-driven
├── api/deps.py         # get_current_user_payload(), require_role() — FastAPI DI
├── routers/            # HTTP layer (thin: validate → delegate → envelope)
├── services/           # domain + integration layer (external.py, redis_svc.py,
│                       #   kafka_consumer.py, scheduler.py, gateway.py, …)
├── models/             # SQLAlchemy declarative models
├── schemas/            # Pydantic request/response models
├── shared/             # bind-mount of busgo/shared (see below)
├── Dockerfile
└── requirements.txt
```

### 2.3.3 Design patterns used, and why

| Pattern | Where | Why |
|---|---|---|
| **API Gateway** | Kong (`infrastructure/kong/kong.yml`) | One public origin, one place for routing/LB/health/retries; clients never learn service topology. `strip_path: true` means `/api/auth/login` reaches the service as `/login`, so services stay unaware of their public prefix (`ROOT_PATH` only fixes up the Swagger server URL). |
| **Database per service** | 13 logical DBs | Enforces the service boundary at the storage layer — no cross-service joins are even possible, so coupling must be explicit and versioned (HTTP or events). |
| **Saga with compensation** | `booking-service/routers/journeys.py` | A multi-leg journey has no distributed transaction available. Legs are locked in order; any failure triggers release of everything already held, then marks the journey `FAILED`. |
| **Orchestration + choreography mix** | booking orchestrates the synchronous critical path; Kafka choreographs the rest | Money and seat locks need deterministic ordering (orchestration); tickets, notifications and audit are eventual (choreography), so a slow ticket render never delays checkout. |
| **Idempotency key** | `booking-service`, `payment-service` | Retries over an unreliable network are inevitable. The key is a unique DB column *and* a Redis cache entry; payments additionally short-circuit to the original `COMPLETED` row. |
| **Distributed lock** | `inventory-service/services/redis_svc.py` | `SET key value NX EX 600` is atomic in Redis, which is exactly the primitive the seat race needs. The DB row is the durable record; Redis is the arbiter. |
| **Circuit breaker + retry with backoff** | `shared/http_client.py` (`ResilientClient`, `tenacity`) | A chronically failing dependency fails fast (5 failures → open for 30 s, then half-open) instead of consuming request workers. |
| **Repository-ish service layer** | `services/external.py`, `services/bank_client.py`, `services/booking_client.py` | Routers never call `httpx` directly, so timeouts, retries and correlation headers are applied uniformly and are testable in one place. |
| **Dependency injection** | FastAPI `Depends` — `get_db`, `get_current_user_payload`, `require_role(UserRole.OPERATOR)` | Auth and session handling become declarative per-endpoint concerns. |
| **Response envelope** | `shared/base_response.py` — `{success, data, message, errors}` | Uniform client parsing and error surfacing. (`deals-service` predates this and returns raw objects — a known inconsistency, §8.3.) |
| **Event-driven fan-out** | `shared/kafka_producer.py` / per-service consumers | Adding a consumer (audit, notifications) requires no change to the producer. |
| **Shared library via bind mount** | `busgo/shared` mounted to `/app/shared` in every container | `health`, `observability`, `http_client`, `kafka_producer`, `base_response`, `enums`, `exceptions` are written once. Trade-off: no independent versioning (§8.3). |
| **Sidecar-free observability** | `setup_observability(app, SERVICE_NAME)` | One call adds `/metrics`, JSON logging and `X-Request-ID` correlation to any service. |
| **Health-check contract** | `create_health_router()` → `/health` (liveness), `/health/ready` (DB+Redis readiness) | Kong's active checks poll `/health`; readiness distinguishes "process up" from "dependencies reachable". |

### 2.3.4 Event catalogue

**Published topics (9):** `booking.created`, `booking.cancelled`, `payment.completed`, `payment.failed`, `ticket.issued`, `refund.initiated`, `seat.lock.expired`, `notification.send`, `audit.log`.

**Consumed event types (~30)**, including `booking.confirmed`, `booking.expired`, `booking.payment_failed`, `journey.payment_failed`, `trip.created/updated/cancelled/delayed/schedule_changed`, `user.registered`, `operator.booking_alert`, `operator.daily_summary`, `operator.revenue_summary`, `operator.route_update`, `admin.new_user`, `admin.new_operator`, `admin.system_alert`, `admin.daily_summary`, `admin.revenue_report`, `admin.complaint`, `ticket.generated`.

### 2.3.5 Reliability & scaling

- **Replication + load balancing.** `auth-service`, `search-service` and `booking-service` are designed to run at 3 replicas. Kong resolves the Compose service name through Docker's embedded DNS (`KONG_DNS_RESOLVER: 127.0.0.11`, `KONG_DNS_STALE_TTL: 4`) so each replica appears as an A-record, and Kong's ring balancer round-robins across them. Every `/health` response includes an `instance` field (the container hostname) so load distribution is directly observable — which is what the load test in §5.4 measures.
- **Health-driven routing.** Active checks poll `/health` every 5 s (3 failures → unhealthy); passive checks trip a target out after 5 HTTP failures, acting as a circuit breaker at the gateway. `retries: 3` re-dispatches a failed request to a different target.
- **Graceful degradation.** `bank-service` starts even if Kafka is unavailable (account provisioning self-heals on first balance fetch); `search-service` returns trips with `availability_unknown` rather than failing if `inventory-service` is down.
- **Router-ordering discipline.** The health router is registered *before* any router with a greedy `/{id}` route, otherwise `/health` would be swallowed and return 401/422, and Kong would mark the whole service unhealthy. This bit four services before it was made a documented convention.

## 2.4 Database Design

### 2.4.1 Entity-Relationship Diagram

Because each service owns its own database, the diagram below is a *logical* ERD. Solid relationships exist inside one service's database and are enforced by real foreign keys; dashed relationships cross a service boundary and are **referential by UUID only** — deliberately not FK-enforced, because the target table lives in a different database.

```mermaid
erDiagram
    USERS ||--o{ REFRESH_TOKENS : "issues"
    USERS ||--o{ OTP_RECORDS : "requests"
    OPERATORS ||--o{ BUSES : "owns"
    OPERATORS ||--o{ ROUTES : "publishes"
    OPERATORS ||--o{ TRIPS : "schedules"
    OPERATORS ||--o{ TRANSIT_ROUTES : "curates"
    BUSES ||--o{ TRIPS : "runs"
    ROUTES ||--o{ TRIPS : "follows"
    BOOKINGS ||--o{ BOOKING_STATUS_HISTORY : "audits"
    JOURNEYS ||--|{ BOOKINGS : "has legs"
    PAYMENTS ||--o{ REFUNDS : "may refund"
    BANK_ACCOUNTS ||--o{ BANK_TRANSACTIONS : "records"

    TRIPS ||..o{ SEAT_INVENTORY : "seats (x-svc)"
    TRIPS ||..o{ BOOKINGS : "booked as (x-svc)"
    USERS ||..o{ BOOKINGS : "makes (x-svc)"
    BOOKINGS ||..|| PAYMENTS : "paid by (x-svc)"
    BOOKINGS ||..|| TICKETS : "issues (x-svc)"
    BOOKINGS ||..o{ CANCELLATION_REQUESTS : "cancelled by (x-svc)"
    USERS ||..o{ BANK_ACCOUNTS : "holds (x-svc)"
    USERS ||..o{ IN_APP_NOTIFICATIONS : "receives (x-svc)"
    USERS ||..o{ TRAVEL_RECORDS : "travelled (x-svc)"
    USERS ||..o{ AUDIT_LOGS : "acted (x-svc)"

    USERS {
        uuid id PK
        string phone "indexed, nullable (Google users)"
        string email UK "indexed, nullable"
        string full_name
        string password_hash "nullable"
        string auth_provider "password | google"
        string provider_subject UK "Supabase subject"
        enum role "CUSTOMER | OPERATOR | ADMIN"
        bool is_verified
        bool is_active
    }
    OPERATORS {
        uuid id PK
        string name
        string contact_phone
        string contact_email
        string license_no
        float commission_rate
        bool is_active
    }
    BUSES {
        uuid id PK
        uuid operator_id FK
        string registration_no UK "indexed"
        enum bus_type
        int total_seats
        jsonb seat_layout
        jsonb amenities
        bool allow_transit
    }
    ROUTES {
        uuid id PK
        uuid operator_id FK
        string origin_city "indexed"
        string destination_city "indexed"
        float distance_km
        jsonb boarding_points
        jsonb dropping_points
    }
    TRIPS {
        uuid id PK
        uuid operator_id FK
        uuid bus_id FK
        uuid route_id FK
        datetime departure_datetime
        datetime arrival_datetime
        numeric fare_amount
        int available_seats
        enum status
        bool allow_transit
    }
    TRANSIT_ROUTES {
        uuid id PK
        uuid operator_id FK "indexed"
        string origin_city "indexed"
        string destination_city "indexed"
        jsonb via_cities "1..2 ordered"
        jsonb leg_assignments
        float combined_discount_pct
        bool is_active
    }
    SEAT_INVENTORY {
        uuid id PK
        uuid trip_id "indexed"
        string seat_number
        enum seat_type
        enum status "AVAILABLE | LOCKED | BOOKED"
        uuid locked_by_booking_id
        datetime lock_expires_at
        uuid booked_by_user_id
    }
    BOOKINGS {
        uuid id PK
        uuid user_id "indexed"
        uuid trip_id "indexed"
        uuid operator_id
        jsonb seat_numbers
        jsonb passenger_details
        date journey_date
        time departure_time
        numeric total_fare
        numeric discount_amount
        uuid journey_id "indexed, nullable"
        int leg_number "nullable"
        enum status
        string idempotency_key UK
        datetime expires_at
    }
    JOURNEYS {
        uuid id PK
        uuid user_id "indexed"
        string origin
        string destination
        int leg_count
        numeric total_fare
        enum status
        string idempotency_key UK
        uuid transit_route_id
        datetime expires_at
    }
    BOOKING_STATUS_HISTORY {
        uuid id PK
        uuid booking_id FK
        enum from_status
        enum to_status
        datetime changed_at
        string reason
    }
    TRAVEL_RECORDS {
        uuid id PK
        uuid user_id "indexed"
        uuid trip_id "indexed"
        uuid operator_id "indexed"
        string origin "indexed"
        string destination "indexed"
        date journey_date
    }
    PAYMENTS {
        uuid id PK
        uuid booking_id "indexed (journey_id for transit)"
        uuid user_id "indexed"
        uuid trip_id "indexed (fraud checks)"
        numeric amount
        enum method
        string gateway_transaction_id UK
        enum status
        jsonb gateway_response
    }
    REFUNDS {
        uuid id PK
        uuid payment_id FK
        uuid booking_id
        numeric amount
        string reason
        enum status
        int estimated_days
    }
    BANK_ACCOUNTS {
        uuid id PK
        uuid user_id "indexed"
        enum account_type
        string provider
        string account_number UK
        string pin
        numeric balance
        string currency
    }
    BANK_TRANSACTIONS {
        uuid id PK
        uuid account_id FK
        string direction "DEBIT | CREDIT"
        numeric amount
        numeric balance_after
        string reference "booking_id"
    }
    TICKETS {
        uuid id PK
        uuid booking_id UK
        uuid user_id "indexed"
        uuid trip_id "indexed"
        jsonb seat_numbers
        string qr_code_data UK "indexed"
        string pdf_url
        enum status
    }
    CANCELLATION_REQUESTS {
        uuid id PK
        uuid booking_id
        uuid user_id
        string reason
        enum status
        numeric refund_amount
    }
    PROMO_CODES {
        uuid id PK
        string code UK "indexed"
        enum discount_type
        numeric discount_value
        numeric min_fare
        numeric max_discount
        int max_uses
        int current_uses
        json applicable_operators
        string operator_id "indexed"
    }
    FLASH_SALES {
        uuid id PK
        string name
        int discount_percentage
        datetime start_time
        datetime end_time
        json applicable_trips
        json applicable_routes
        string operator_id "indexed"
    }
    IN_APP_NOTIFICATIONS {
        uuid id PK
        uuid user_id "indexed"
        string role
        enum type "26 kinds"
        string title
        text message
        json metadata
        bool is_read
    }
    NOTIFICATION_LOGS {
        uuid id PK
        uuid user_id
        enum channel "EMAIL|SMS|PUSH|WHATSAPP"
        string template_name
        json payload
        enum status
    }
    AUDIT_LOGS {
        uuid id PK
        string event_type "indexed"
        string entity_type
        uuid entity_id "indexed"
        uuid user_id "indexed"
        json payload
        datetime created_at "indexed"
    }
    NOTICES {
        uuid id PK
        string title
        text body
        bool is_active
    }
```

### 2.4.2 Normalization decisions

The schema is **3NF for all relational, money-touching data**, with deliberate, documented denormalisation where 3NF would have bought nothing:

**Held to 3NF**

- `operators → buses → trips ← routes` is fully decomposed. A trip stores *references* to its bus and route, never a copy of the registration number or the city pair, so renaming a route cannot desynchronise history.
- `payments` and `refunds` are separate tables in a 1-to-many relation — a payment may be refunded partially or repeatedly.
- `bank_accounts` and `bank_transactions` form a proper ledger: the account holds the current balance, and each transaction records `balance_after`, so the balance is reconstructible and auditable.
- Booking state changes live in `booking_status_history` rather than being overwritten in place, giving a complete transition trail (`from_status → to_status`, reason, timestamp).

**Deliberately denormalised**

| Decision | Rationale |
|---|---|
| `bookings.seat_numbers` and `bookings.passenger_details` as `JSONB` instead of a `booking_passengers` child table | A booking has 1–4 passengers that are always read and written together, are never queried independently, and are a **point-in-time snapshot**. Normalising would add a join to every read for no query benefit. |
| `buses.seat_layout`, `buses.amenities`, `routes.boarding_points`, `routes.dropping_points` as `JSONB` | Genuinely document-shaped, operator-defined and variable-arity. A `seat` table per bus would be a schema for data the system only ever consumes whole. |
| `bookings.journey_date` / `departure_time` copied from the trip | Immutability of the contract: if an operator later reschedules a trip, the ticket must still show what the passenger actually bought. |
| `travel_records` duplicating (user, origin, destination, operator) from bookings | A purpose-built read model for the "fill empty seats" campaign query. Answering it from `bookings` would mean a cross-service join, which the architecture forbids. |
| `transit_routes.via_cities` / `leg_assignments` as `JSONB` | An ordered list of 1–2 intermediate cities with per-leg assignments — array semantics matter, and it is always read as a unit. |
| `audit_logs.payload`, `notification_logs.payload`, `in_app_notifications.metadata` as `JSON` | Schemaless by design: these must accept the payload of *any* event type without a migration whenever a new event is introduced. |
| Cross-service UUID references without FKs (dashed lines above) | A physical FK across databases is impossible. The trade-off is accepted deliberately: consistency is maintained by the saga, the events and the compensation logic rather than by the RDBMS. |

### 2.4.3 Indexes

| Table | Index | Query it serves |
|---|---|---|
| `users` | `email` (unique), `phone`, `provider_subject` (unique) | Login, Google-account linking, admin user lookup |
| `refresh_tokens` | `token` (unique) | Token rotation on refresh |
| `otp_records` | `phone` | OTP verification |
| `seat_inventory` | `trip_id` | Every seat-map render and lock attempt |
| `bookings` | `user_id`, `trip_id`, `journey_id`, `idempotency_key` (unique) | "My bookings", trip manifests, journey leg grouping, duplicate suppression |
| `journeys` | `user_id`, `idempotency_key` (unique) | Journey history and idempotent creation |
| `travel_records` | `user_id`, `trip_id`, `operator_id`, `origin`, `destination` | The corridor query behind "fill empty seats" |
| `payments` | `booking_id`, `user_id`, `trip_id`, `gateway_transaction_id` (unique) | Payment history and the *attempts-per-trip* fraud check |
| `bank_accounts` | `user_id`, `account_number` (unique) | Wallet lookup and debit |
| `tickets` | `user_id`, `trip_id`, `booking_id` (unique), `qr_code_data` (`ix_tickets_qr_data`) | Ticket retrieval and **QR scan validation at the gate** |
| `buses` | `registration_no` (unique) | Fleet lookup, duplicate prevention |
| `routes` | `origin_city`, `destination_city` | Route browsing and transit assembly |
| `transit_routes` | `operator_id`, `origin_city`, `destination_city` | Curated-itinerary lookup by `transit-service` |
| `promo_codes` | `code` (unique), `operator_id` | Promo validation on the checkout hot path |
| `flash_sales` | `operator_id` | Operator deal listings |
| `in_app_notifications` | `user_id` | Inbox and unread count (polled every 30 s) |
| `audit_logs` | `event_type`, `entity_id`, `user_id`, `created_at` | Admin forensic queries by any dimension |

Beyond Postgres, **Elasticsearch's `bus_trips` index** is the search-side denormalisation: `keyword` fields for `origin_city`, `destination_city`, `operator_id`, `bus_type` and `status`, `date` fields for departure/arrival, and numerics for fare and seats. It exists precisely so that search never queries the operator database.

### 2.4.4 Data Sync Mechanics — how database changes reach the UI without a manual refresh

BusGo keeps the UI live through **three complementary mechanisms**; there is no manual "press F5 to see new data" step anywhere in the booking flow.

**1. Event-driven server-side propagation (Kafka).** A write in one service's database is broadcast as an event, and every interested service updates *its own* store. When an operator creates a trip, `operator-service` commits to `operator_db` and publishes `trip.created`; `search-service` consumes it and indexes the trip into Elasticsearch — so the trip becomes searchable to passengers without anyone reindexing by hand. The same mechanism drives `payment.completed → booking CONFIRMED → ticket.issued → notification`, so a completed payment materialises a ticket and an inbox entry with no user action.

**2. Client-side cache invalidation (React Query).** The web app treats server data as a cache with a lifetime. After any mutation, the affected queries are invalidated and refetched, so the seat map, booking list and wallet balance re-render from fresh data automatically. Volatile resources — most importantly the seat map — are additionally refetched on window focus and at interval, so a seat another user just locked greys out on its own.

**3. Notification polling (30 s).** `notificationStore.startPolling()` runs while the `NotificationBell` is mounted, calling `GET /api/notifications/` and `/stats` every 30 seconds and updating the unread badge in place. This is what makes server-originated events (a delayed bus, an operator offer, a refund completion) appear in a UI the user is not actively interacting with.

```mermaid
sequenceDiagram
    autonumber
    participant OP as Operator (portal)
    participant OS as operator-service
    participant DB as operator_db
    participant K as Kafka
    participant SS as search-service
    participant ES as Elasticsearch
    participant NS as notification-service
    participant ND as notification_db
    participant UI as Passenger UI

    OP->>OS: POST /api/operators/trips/ (new trip)
    OS->>DB: INSERT trip  (committed)
    OS->>K: publish trip.created
    K-->>SS: trip.created
    SS->>ES: index bus_trips/{trip_id}
    Note over ES: trip is now searchable — no manual reindex

    UI->>SS: GET /api/search/buses (React Query, staleTime elapsed)
    SS-->>UI: trip appears

    Note over OP,ND: later — operator delays the trip
    OP->>OS: PUT /api/operators/trips/{id} (delay)
    OS->>K: publish trip.delayed
    K-->>SS: reindex updated trip
    K-->>NS: trip.delayed
    NS->>ND: INSERT in_app_notification (BUS_DELAYED) per affected passenger
    loop every 30 s while the bell is mounted
        UI->>NS: GET /api/notifications/ + /stats
        NS-->>UI: unread count += 1
    end
    Note over UI: badge updates in place — no page refresh
```

**Why polling rather than WebSockets/SSE.** A 30-second poll of a single indexed query (`user_id`) was the right trade-off for this system's scale and deadline: it needs no sticky sessions, survives Kong's stateless load balancing across replicas with no extra configuration, and degrades gracefully on flaky mobile networks. The honest cost is up to 30 seconds of latency on a notification and a constant baseline of requests. Replacing the poll with a WebSocket or SSE channel — most naturally exposed through `notification-service` and fanned out from the existing Kafka consumers — is the first item in §8.3.

The one place where 30 seconds would be too slow, the **seat map**, is handled differently: seat state is re-read directly from `inventory-service` (DB rows overlaid with live Redis locks) on focus and interval during selection, and the authoritative check happens at lock time anyway — a stale map can only cost the user a `409`, never a double-booked seat.

---
# 3. API Documentation

## 3.1 API Design Overview

**Style — REST over JSON.** Resources are nouns (`/bookings`, `/trips`, `/tickets`, `/promos`), HTTP verbs carry the semantics (`GET` read, `POST` create/command, `PUT` full update, `PATCH` partial update, `DELETE` remove), and status codes are meaningful (`200`, `201`, `400` validation, `401` unauthenticated, `403` role/limit violation, `404` missing, `409` seat conflict, `503` dependency unavailable). GraphQL was considered and rejected: with 14 independently deployed services, a single GraphQL schema would have re-coupled them behind one gateway resolver layer, which is the opposite of what the architecture is demonstrating.

**Base URL.**

| Environment | Base URL |
|---|---|
| Production | `https://busgo.farefin.com/api` |
| Local (Docker Compose, via Kong) | `http://localhost:18085/api` — mapped from `KONG_PORT`, default `8085` |
| Direct service access (debug only) | `http://localhost:81xx` — see the port table in §6.2 |

**Versioning scheme.** The API is currently **v1 implicit** — there is no `/v1` path segment. The chosen forward path is *gateway-level versioning*: because every route is declared in `kong.yml`, a future `v2` is introduced by adding routes with a `/api/v2/...` path pointing at new upstreams, while `/api/...` continues to serve v1 from the existing ones — clients migrate independently and no service code changes. This is stated plainly as a limitation in §8.3: shipping without an explicit version segment was a deliberate scope decision, not an oversight.

**Routing model.** Kong matches on path prefix and strips it (`strip_path: true`), so `/api/auth/login` arrives at `auth-service` as `/login`. Each service is told its public prefix through `ROOT_PATH`, which only affects the server URL advertised in its OpenAPI document — service code never hardcodes the gateway prefix. Both plural and singular prefixes are accepted for the main resources (`/api/bookings` and `/api/booking`, `/api/tickets` and `/api/ticket`, …), which removed a whole class of client 404s.

**Response envelope.** Every service except `deals-service` wraps responses in a uniform envelope (`shared/base_response.py`):

```json
{ "success": true, "data": { }, "message": "", "errors": null }
```

**Authentication.** A `Bearer` JWT in the `Authorization` header, verified independently by each service (§4). Public endpoints (search, transit search, city list, route/deal browsing, seat maps) require no token, which is what makes guest browsing possible on web and mobile.

**Correlation.** Every request carries or is assigned an `X-Request-ID`, echoed on the response and propagated by `ResilientClient` on all downstream calls, so one user action is traceable across gateway → service → service in Loki.

## 3.2 Endpoint Reference

Routes are given as the **public path through Kong** (prefix `https://busgo.farefin.com`). "Auth" indicates whether a valid JWT is required, and where a specific role is enforced.

### 3.2.1 `auth-service` — `/api/auth`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| POST | `/api/auth/register` | Register a new user (name, phone, email, password, role) | No |
| POST | `/api/auth/login` | Password login by phone → access + refresh token | No |
| POST | `/api/auth/token` | OAuth2 password-grant form login (used by Swagger's *Authorize*) | No |
| POST | `/api/auth/google-login` | Exchange a verified Supabase Google session for a BusGo session | No |
| POST | `/api/auth/refresh` | Rotate an access token using a refresh token | No (refresh token in body) |
| POST | `/api/auth/logout` | Revoke the current refresh token | Yes |
| GET | `/api/auth/me` | Current user profile | Yes |
| PUT | `/api/auth/me` | Update own profile (name, phone, email) | Yes |
| POST | `/api/auth/send-otp` | Send a one-time password to a phone number | No |
| POST | `/api/auth/verify-otp` | Verify an OTP and mark the user verified | No |
| POST | `/api/auth/users/lookup` | Resolve user ids → display names (used by operator/admin views) | Yes |
| POST | `/api/auth/create-admin` | Bootstrap an administrator account | Yes (guarded) |
| POST | `/api/auth/reset-admin-password` | Recover administrator access | Yes (guarded) |

### 3.2.2 `search-service` — `/api/search`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| GET | `/api/search/cities` | List searchable cities | No |
| GET | `/api/search/buses` | Search trips by `origin`, `destination`, `date` (+ filters); merges live seat availability | No |
| GET | `/api/search/buses/{trip_id}` | Full detail for one trip | No |
| POST | `/api/search/reindex` | Rebuild the Elasticsearch `bus_trips` index from operator data | No (operational) |

### 3.2.3 `transit-service` — `/api/transit`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| GET | `/api/transit/search` | Find multi-leg connecting itineraries (`origin`, `destination`, `journey_date`); operator-curated results ranked first | No |

### 3.2.4 `inventory-service` — `/api/inventory`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| POST | `/api/inventory/trips/{trip_id}/initialize` | Create the seat inventory for a trip from its layout | No (internal) |
| GET | `/api/inventory/trips/{trip_id}/seats` | Live seat map (DB rows overlaid with Redis locks) | No |
| GET | `/api/inventory/trips/{trip_id}/available-count` | Count of genuinely free seats | No |
| POST | `/api/inventory/trips/{trip_id}/seats/lock` | **Atomically lock** seats for a booking (Redis `SET NX EX 600`) | No (internal) |
| POST | `/api/inventory/trips/{trip_id}/seats/release` | Release locks (compensation / expiry) | No (internal) |
| POST | `/api/inventory/trips/{trip_id}/seats/confirm` | Promote locked seats to `BOOKED` after payment | No (internal) |
| POST | `/api/inventory/trips/{trip_id}/seats/unbook` | Return booked seats to the pool after a cancellation | No (internal) |

### 3.2.5 `booking-service` — `/api/bookings`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| POST | `/api/bookings/` | Create a booking: validate against operator, apply promo, lock seats, emit events | Yes |
| GET | `/api/bookings/my` | Current user's bookings (grouped by journey) | Yes |
| GET | `/api/bookings/{booking_id}` | Single booking detail | Yes (owner) |
| GET | `/api/bookings/trip/{trip_id}` | Passenger manifest for a trip | Yes (operator) |
| GET | `/api/bookings/operator/{operator_id}` | All bookings for an operator | Yes (operator) |
| POST | `/api/bookings/{booking_id}/confirm-payment` | Confirm a paid booking, confirm seats, issue ticket | Yes |
| POST | `/api/bookings/{booking_id}/cancel` | Cancel and trigger the refund flow | Yes (owner) |
| GET | `/api/bookings/{booking_id}/cancellation-info` | Refund eligibility and amount before cancelling | Yes (owner) |
| POST | `/api/bookings/{booking_id}/apply-promo` | Validate and persist a promo discount pre-payment | Yes (owner) |
| DELETE | `/api/bookings/{booking_id}/apply-promo` | Remove an applied promo | Yes (owner) |
| GET | `/api/bookings/travel-history/my` | The user's travel history | Yes |
| POST | `/api/bookings/travel-records/sync` | Rebuild travel records from confirmed bookings | Yes (operational) |
| POST | `/api/bookings/trips/{trip_id}/interested-passengers` | Past passengers on this corridor ("fill empty seats") | Yes (operator) |
| POST | `/api/bookings/trips/{trip_id}/notify-interested` | Push a targeted offer to those passengers | Yes (operator) |
| POST | `/api/bookings/journeys/` | **Multi-leg journey saga** — lock every leg or release all | Yes |
| GET | `/api/bookings/journeys/{journey_id}` | Journey with ordered legs and transfer waits | Yes (owner) |
| POST | `/api/bookings/journeys/{journey_id}/confirm-payment` | Confirm the whole journey after one payment | Yes (owner) |
| POST | `/api/bookings/journeys/{journey_id}/cancel` | Cancel every leg together | Yes (owner) |

### 3.2.6 `payment-service` — `/api/payments`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| POST | `/api/payments/initiate` | Start a payment for a booking **or** a journey; runs fraud checks and debits the account | Yes |
| POST | `/api/payments/{gateway}/callback` | Mock gateway callback (bKash / Nagad / bank) | No (gateway) |
| GET | `/api/payments/my` | Current user's payment history | Yes |
| GET | `/api/payments/{payment_id}` | Single payment detail | Yes (owner) |
| GET | `/api/payments/booking/{booking_id}` | Payment(s) for a booking | Yes (owner) |
| POST | `/api/payments/{payment_id}/refund` | Initiate a refund | Yes |
| POST | `/api/payments/mock/simulate-failure` | Test hook: force the mock gateway to fail | No (test only) |

### 3.2.7 `bank-service` — `/api/bank`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| POST | `/api/bank/provision` | Create simulated wallet/bank accounts for a user | Yes |
| GET | `/api/bank/accounts/my` | Own accounts and balances | Yes |
| GET | `/api/bank/transactions/my` | Own ledger entries | Yes |
| POST | `/api/bank/verify-debit` | Verify PIN + balance and debit (called by `payment-service`) | Yes (internal) |
| POST | `/api/bank/credit` | Credit an account (refunds) | Yes (internal) |
| GET | `/api/bank/admin/accounts` | All accounts | Yes (ADMIN) |
| GET | `/api/bank/admin/accounts/by-user/{user_id}` | Accounts of one user | Yes (ADMIN) |
| POST | `/api/bank/admin/accounts/{account_id}/set-balance` | Set a demo balance | Yes (ADMIN) |

### 3.2.8 `ticket-service` — `/api/tickets`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| GET | `/api/tickets/my` | All of the user's tickets | Yes |
| GET | `/api/tickets/{ticket_id}` | Single ticket | Yes (owner) |
| GET | `/api/tickets/booking/{booking_id}` | Ticket for a booking (one per leg) | Yes (owner) |
| GET | `/api/tickets/files/{booking_id}/qr` | QR code image | Yes (owner) |
| GET | `/api/tickets/files/{booking_id}/pdf` | Printable PDF ticket | Yes (owner) |
| POST | `/api/tickets/validate-qr` | Validate a scanned QR at boarding | Yes (operator) |

### 3.2.9 `cancellation-service` — `/api/cancellations`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| POST | `/api/cancellations/` | Raise a cancellation request and compute the refund | Yes |
| GET | `/api/cancellations/{id}` | Cancellation request status | Yes |
| GET | `/api/cancellations/booking/{booking_id}` | Cancellations for a booking | Yes |
| POST | `/api/cancellations/operator-cancel` | Operator cancels a trip; refunds every passenger | Yes (OPERATOR) |

### 3.2.10 `operator-service` — `/api/operators`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| GET | `/api/operators/operators/` | List operators | No |
| POST | `/api/operators/operators/register` | Register an operator profile | Yes |
| GET | `/api/operators/operators/{id}` | Operator detail | No |
| PUT | `/api/operators/operators/{id}` | Update an operator | Yes (OPERATOR) |
| POST | `/api/operators/operators/{id}/buses` | Add a bus | Yes (OPERATOR) |
| GET | `/api/operators/operators/{id}/buses` | List an operator's buses | Yes (OPERATOR) |
| PUT | `/api/operators/buses/{id}` | Update a bus | Yes (OPERATOR) |
| DELETE | `/api/operators/buses/{id}` | Remove a bus | Yes (OPERATOR) |
| POST | `/api/operators/operators/{id}/routes` | Add a route | Yes (OPERATOR) |
| GET | `/api/operators/operators/{id}/routes` | List an operator's routes | Yes (OPERATOR) |
| GET | `/api/operators/routes/` | All routes (public browsing) | No |
| PUT | `/api/operators/routes/{id}` | Update a route | Yes (OPERATOR) |
| DELETE | `/api/operators/routes/{id}` | Remove a route | Yes (OPERATOR) |
| GET | `/api/operators/trips/` | List trips | No |
| POST | `/api/operators/trips/` | Schedule a trip (emits `trip.created` → reindexed) | Yes (OPERATOR) |
| GET | `/api/operators/trips/{id}` | Trip detail — the **authoritative fare source** for bookings | No |
| PUT | `/api/operators/trips/{id}` | Update a trip | Yes (OPERATOR) |
| POST | `/api/operators/trips/{id}/cancel` | Cancel a trip | Yes (OPERATOR) |
| DELETE | `/api/operators/trips/{id}` | Delete a trip | Yes (OPERATOR) |
| GET | `/api/operators/transit-routes/` | Public curated transit routes (used by `transit-service`) | No |
| GET | `/api/operators/transit-routes/mine` | The operator's own transit routes | Yes (OPERATOR) |
| POST | `/api/operators/transit-routes/` | Publish a curated connecting route | Yes (OPERATOR) |
| PUT | `/api/operators/transit-routes/{id}` | Update a curated route | Yes (OPERATOR) |
| DELETE | `/api/operators/transit-routes/{id}` | Remove a curated route | Yes (OPERATOR) |

### 3.2.11 `deals-service` — `/api/deals`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| POST | `/api/deals/validate-promo` | Validate a code against fare, window, usage cap and prior use | No |
| POST | `/api/deals/apply-promo` | Consume a promo (increment usage, mark user) | No (internal) |
| GET | `/api/deals/promos/` | List promo codes | No |
| POST | `/api/deals/promos/` | Create a promo code | Yes (OPERATOR/ADMIN) |
| PUT | `/api/deals/promos/{id}` | Update a promo code | Yes (OPERATOR/ADMIN) |
| DELETE | `/api/deals/promos/{id}` | Delete a promo code | Yes (OPERATOR/ADMIN) |
| GET | `/api/deals/flash-sales/` | List flash sales | No |
| GET | `/api/deals/flash-sales/active` | Currently running flash sales | No |
| POST | `/api/deals/flash-sales/` | Create a flash sale | Yes (OPERATOR/ADMIN) |
| PUT | `/api/deals/flash-sales/{id}` | Update a flash sale | Yes (OPERATOR/ADMIN) |
| DELETE | `/api/deals/flash-sales/{id}` | Delete a flash sale | Yes (OPERATOR/ADMIN) |

### 3.2.12 `notification-service` — `/api/notifications`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| GET | `/api/notifications/` | Paginated inbox (`page`, `limit`, `unread_only`) | Yes |
| GET | `/api/notifications/stats` | Unread count and per-type totals (polled every 30 s) | Yes |
| PATCH | `/api/notifications/{notification_id}/read` | Mark one as read | Yes (owner) |
| PATCH | `/api/notifications/read-all` | Mark everything as read | Yes |
| DELETE | `/api/notifications/{notification_id}` | Delete one notification | Yes (owner) |
| DELETE | `/api/notifications/clear-all` | Clear the inbox | Yes |
| POST | `/api/notifications/send` | Send a targeted notification (operator → passengers) | Yes (OPERATOR/ADMIN) |
| POST | `/api/notifications/admin/broadcast` | Broadcast to a role or the whole platform | Yes (ADMIN) |

### 3.2.13 `admin-service` — `/api/admin`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| GET | `/api/admin/dashboard-stats` | Platform totals (users, operators, trips, revenue) | Yes (ADMIN) |
| GET | `/api/admin/users` | All users | Yes (ADMIN) |
| PATCH | `/api/admin/users/{user_id}/role` | Promote/demote a user | Yes (ADMIN) |
| GET | `/api/admin/user-history` | Per-user activity history | Yes (ADMIN) |
| GET | `/api/admin/operators` | All operators | Yes (ADMIN) |
| GET | `/api/admin/routes` | All routes | Yes (ADMIN) |
| GET | `/api/admin/trips` | All trips | Yes (ADMIN) |
| GET | `/api/admin/transactions` | All transactions | Yes (ADMIN) |
| GET | `/api/admin/transactions/summary` | Revenue summary | Yes (ADMIN) |
| GET | `/api/admin/notices` | All notices | Yes (ADMIN) |
| GET | `/api/admin/notices/active` | Active notices (shown on the public site) | No |
| POST | `/api/admin/notices` | Publish a notice | Yes (ADMIN) |
| PATCH | `/api/admin/notices/{notice_id}` | Edit a notice | Yes (ADMIN) |
| DELETE | `/api/admin/notices/{notice_id}` | Remove a notice | Yes (ADMIN) |

### 3.2.14 `audit-service` — `/api/audit`

| Method | Route | Description | Auth Required |
|---|---|---|---|
| GET | `/api/audit/audit/logs` | Query the audit trail (`event_type`, `entity_type`, `skip`, `limit`) | Yes (ADMIN) |
| GET | `/api/audit/audit/logs/booking/{booking_id}` | Full event history for a booking | Yes (ADMIN) |
| GET | `/api/audit/audit/logs/user/{user_id}` | Full event history for a user | Yes (ADMIN) |

### 3.2.15 Platform endpoints (all 14 services)

| Method | Route | Description | Auth Required |
|---|---|---|---|
| GET | `/api/{service}/health` | Liveness; includes `instance` (container id) — used by Kong's active checks and the load-balancing test | No |
| GET | `/api/{service}/health/ready` | Readiness: `200` only if PostgreSQL **and** Redis respond, else `503` | No |
| GET | `/api/{service}/metrics` | Prometheus metrics (`http_requests_total`, `http_request_duration_seconds`) | No |
| GET | `/api/{service}/docs` | Interactive Swagger UI | No |
| GET | `/api/{service}/openapi.json` | Raw OpenAPI 3.1 document | No |

> **Total: 120+ documented endpoints across 14 services.**

## 3.3 Swagger / Postman Collection Link

FastAPI generates an OpenAPI 3.1 document per service automatically; each is served through Kong, so **every service's Swagger UI is publicly reachable** on the deployed host:

| Service | Public Swagger URL |
|---|---|
| Auth | https://busgo.farefin.com/api/auth/docs |
| Search | https://busgo.farefin.com/api/search/docs |
| Transit | https://busgo.farefin.com/api/transit/docs |
| Inventory | https://busgo.farefin.com/api/inventory/docs |
| Booking | https://busgo.farefin.com/api/bookings/docs |
| Payment | https://busgo.farefin.com/api/payments/docs |
| Bank | https://busgo.farefin.com/api/bank/docs |
| Ticket | https://busgo.farefin.com/api/tickets/docs |
| Cancellation | https://busgo.farefin.com/api/cancellations/docs |
| Operator | https://busgo.farefin.com/api/operators/docs |
| Deals | https://busgo.farefin.com/api/deals/docs |
| Notification | https://busgo.farefin.com/api/notifications/docs |
| Admin | https://busgo.farefin.com/api/admin/docs |
| Audit | https://busgo.farefin.com/api/audit/docs |

Raw OpenAPI JSON is at `…/openapi.json` for each service and can be imported straight into Postman (*Import → Link*), which produces a ready-made collection per service.

A hand-written, copy-pasteable reference covering every service — including the transit journey saga and the seat-race test — lives in the repository at [`busgo/tests/curl_commands.md`](../busgo/tests/curl_commands.md), with sample payloads in [`busgo/tests/test_data.json`](../busgo/tests/test_data.json).

> **To submit a single Postman link:** import the 14 `openapi.json` documents into one Postman workspace, then *Share → Via public link*, and paste that URL into the Project Links table on page 2.

## 3.4 Sample Request & Response

### 3.4.1 Google login — exchange a Supabase session for a BusGo session

**Request**

```http
POST /api/auth/google-login HTTP/1.1
Host: busgo.farefin.com
Content-Type: application/json

{ "token": "<supabase_access_token>" }
```

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "8f14e45f-ceea-467a-9f0a-3d1b2c9e77aa",
    "token_type": "bearer",
    "user": {
      "id": "3f2b9c10-7a4e-4f1d-9c2a-5b8e6d4a1c33",
      "full_name": "Tauseef Rahman",
      "email": "tauseef@example.com",
      "phone": "01700000000",
      "role": "CUSTOMER",
      "is_verified": true
    }
  },
  "message": "Login successful"
}
```

**Response `401 Unauthorized`** — the Supabase session is not a verified Google identity:

```json
{ "detail": "A verified Google account is required" }
```

### 3.4.2 Search buses

**Request**

```http
GET /api/search/buses?origin=Dhaka&destination=Cumilla&date=2026-08-15 HTTP/1.1
Host: busgo.farefin.com
```

**Response `200 OK`**

```json
{
  "success": true,
  "data": [
    {
      "trip_id": "b41d7c2e-9f65-4a18-8f0d-2c7e5a91b3d4",
      "operator_id": "1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9",
      "operator_name": "Green Line Paribahan",
      "bus_registration_no": "DHAKA-METRO-B-1234",
      "bus_type": "AC_BUSINESS",
      "origin_city": "Dhaka",
      "destination_city": "Cumilla",
      "departure_datetime": "2026-08-15T08:00:00+06:00",
      "arrival_datetime": "2026-08-15T11:00:00+06:00",
      "fare_amount": 850.0,
      "available_seats": 27,
      "amenities": ["WIFI", "CHARGING_PORT", "BLANKET"],
      "boarding_points": [{ "name": "Gabtoli Bus Terminal", "address": "Gabtoli, Dhaka" }],
      "dropping_points": [{ "name": "Cumilla Cantonment", "address": "Cumilla" }],
      "status": "SCHEDULED"
    }
  ],
  "message": "1 trip found"
}
```

### 3.4.3 Create a booking (the critical path)

**Request**

```http
POST /api/bookings/ HTTP/1.1
Host: busgo.farefin.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "trip_id": "b41d7c2e-9f65-4a18-8f0d-2c7e5a91b3d4",
  "operator_id": "1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9",
  "seat_numbers": ["A1", "A2"],
  "passenger_details": [
    { "name": "Tauseef Rahman", "age": 24, "gender": "male",   "seat": "A1" },
    { "name": "Amina Islam",    "age": 23, "gender": "female", "seat": "A2" }
  ],
  "boarding_point": "Gabtoli Bus Terminal",
  "dropping_point": "Cumilla Cantonment",
  "journey_date": "2026-08-15",
  "departure_time": "08:00:00",
  "total_fare": 1720.0,
  "promo_code": "EIDSPECIAL",
  "idempotency_key": "b2f7c1e0-4d3a-4f5b-9c6d-7e8f9a0b1c2d"
}
```

*(`total_fare` = 850 × 2 seats + 20 service fee. The server independently recomputes this from `operator-service` and rejects the request if it disagrees by more than 0.01.)*

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "booking_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "user_id": "3f2b9c10-7a4e-4f1d-9c2a-5b8e6d4a1c33",
    "trip_id": "b41d7c2e-9f65-4a18-8f0d-2c7e5a91b3d4",
    "operator_id": "1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9",
    "boarding_point": "Gabtoli Bus Terminal",
    "dropping_point": "Cumilla Cantonment",
    "journey_date": "2026-08-15",
    "departure_time": "08:00:00",
    "seat_numbers": ["A1", "A2"],
    "expires_at": "2026-08-01T10:40:00+00:00",
    "total_fare": 1548.0
  },
  "message": "Booking created successfully"
}
```

**Response `409 Conflict`** — another user won the seat race:

```json
{ "detail": "Seat A1 is already booked" }
```

**Response `400 Bad Request`** — the client sent a stale fare:

```json
{ "detail": "Fare changed; refresh the trip and try again" }
```

### 3.4.4 Transit itinerary search (multi-leg)

**Request**

```http
GET /api/transit/search?origin=Dhaka&destination=Sylhet&journey_date=2026-08-15 HTTP/1.1
Host: busgo.farefin.com
```

**Response `200 OK`** (abridged — up to 5 itineraries)

```json
{
  "success": true,
  "data": {
    "origin": "Dhaka",
    "destination": "Sylhet",
    "itineraries": [
      {
        "source": "operator",
        "transit_route_id": "6d1f8b3a-2c9e-4d7f-8a1b-3c5e7f9a0b2d",
        "operator_name": "Green Line Paribahan",
        "legs": [
          { "leg_number": 1, "trip_id": "…", "origin_city": "Dhaka",   "destination_city": "Cumilla",
            "departure_datetime": "2026-08-15T08:00:00+06:00", "arrival_datetime": "2026-08-15T11:00:00+06:00", "fare": 850.0 },
          { "leg_number": 2, "trip_id": "…", "origin_city": "Cumilla", "destination_city": "Sylhet",
            "departure_datetime": "2026-08-15T12:00:00+06:00", "arrival_datetime": "2026-08-15T17:00:00+06:00", "fare": 1100.0 }
        ],
        "transfers": [{ "at": "Cumilla", "wait_minutes": 60 }],
        "total_fare": 1950.0,
        "combined_discount_pct": 10.0,
        "final_fare": 1755.0,
        "total_duration_minutes": 540
      },
      {
        "source": "auto",
        "legs": [ /* … discovered by the graph search … */ ],
        "transfers": [{ "at": "Bhairab", "wait_minutes": 45 }],
        "total_fare": 1800.0,
        "final_fare": 1800.0
      }
    ]
  },
  "message": "2 itineraries found"
}
```

### 3.4.5 Payment initiation with fraud checks

**Request**

```http
POST /api/payments/initiate HTTP/1.1
Host: busgo.farefin.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "booking_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "amount": 1548.0,
  "method": "BKASH",
  "mobile_number": "01700000000",
  "pin": "1234"
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "payment_id": "a3d5f7b9-1c2e-4a6b-8d0f-2e4c6a8b0d1f",
    "redirect_url": "https://busgo.farefin.com/api/payments/bkash/callback?payment_id=a3d5f7b9-…"
  },
  "message": "Payment initiated"
}
```

**Response `400 Bad Request`** — tampered amount (fraud check 1):

```json
{ "detail": "Payment amount does not match booking fare" }
```

**Response `403 Forbidden`** — fourth attempt on the same trip (fraud check 2; seats are then released):

```json
{ "detail": "Maximum payment attempts exceeded for this trip" }
```

### 3.4.6 Health & readiness (used by Kong and the test suite)

```http
GET /api/bookings/health/ready
```

```json
{
  "status": "ready",
  "service": "booking-service",
  "instance": "a1b2c3d4e5f6",
  "checks": { "database": "ok", "redis": "ok" }
}
```

If PostgreSQL or Redis is unreachable the same endpoint returns `503` with the failing check named — which is how Kong removes the instance from rotation.

---

# 4. Authentication & Security

## 4.1 Authentication Strategy

**Chosen strategy: OAuth 2.0 (Google, via Supabase Auth) for interactive sign-in, exchanged for stateless HS256 JWTs for API access, with rotating refresh tokens.**

### Why this combination

| Requirement | Why JWT / OAuth won |
|---|---|
| 14 independent services must authenticate the same user | A **stateless JWT** is verified locally by each service with a shared secret — no network call to `auth-service` on every request, which would have made it a single point of failure and added latency to every hop. Server-side sessions would have required either sticky sessions (defeating Kong's load balancing) or a shared session store consulted on every request. |
| Three clients (web SPA, two React Native apps) | A bearer token works identically in a browser and in a native app. Cookie-based sessions do not translate cleanly to React Native. |
| Users should not have to invent and remember another password | **Google OAuth** removes password storage, reset flows and credential-stuffing exposure for the interactive path entirely. |
| Short-lived credentials, long-lived sessions | **15-minute access tokens** limit the damage of a leaked token; **7-day refresh tokens**, stored server-side in `refresh_tokens` and revocable, keep users signed in. |

### How Google sign-in works end to end

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant C as Client (web / mobile)
    participant SB as Supabase Auth
    participant G as Google
    participant A as auth-service
    participant DB as auth_db

    U->>C: "Continue with Google"
    C->>SB: signInWithOAuth(provider=google, redirectTo)
    SB->>G: OAuth 2.0 authorization request
    G-->>U: consent screen
    U->>G: approve
    G-->>SB: authorization code
    SB-->>C: redirect to /login?google=callback with a Supabase session
    C->>A: POST /api/auth/google-login { token: supabase_access_token }
    A->>SB: GET /auth/v1/user (apikey + Bearer token)
    SB-->>A: verified identity { id, email, app_metadata.providers }
    A->>A: reject unless provider includes "google" AND email present
    A->>DB: find by provider_subject OR lower(email)
    alt existing user
        DB-->>A: link provider_subject, preserve existing ROLE
    else new user
        A->>DB: INSERT user (role = CUSTOMER or OPERATOR only)
    end
    A->>A: mint HS256 access (15 min) + refresh (7 days)
    A->>DB: persist refresh token
    A-->>C: { access_token, refresh_token, user }
    C->>C: store in Zustand + cookie (web) / SecureStore (mobile)
```

Three properties of this design matter:

1. **BusGo remains the source of truth for identity and role.** Supabase proves *who the person is*; the local `users` table decides *what they may do*. A Google account cannot self-assign a role.
2. **The token is verified server-side, not trusted.** `auth-service` calls Supabase's `/auth/v1/user` with the supplied token and rejects anything that is not a verified Google identity — the client's claim about itself is never believed.
3. **Account linking is by verified e-mail.** An existing password-era account is linked to its Google identity on first sign-in and **keeps its existing role**, so an operator does not silently become a customer.

### Token lifecycle

| Property | Value |
|---|---|
| Algorithm | HS256 (`python-jose`) |
| Access token TTL | 15 minutes |
| Refresh token TTL | 7 days, stored in `refresh_tokens` with `is_revoked` |
| Claims | `user_id`, `role`, `exp` |
| Transport | `Authorization: Bearer <token>` |
| Web storage | Zustand `persist` → `localStorage`, plus a `SameSite=Lax` cookie fallback |
| Mobile storage | `expo-secure-store` (Keychain / Keystore) |
| Refresh | `POST /api/auth/refresh`; the client interceptor refreshes once and replays queued requests |
| Revocation | `POST /api/auth/logout` marks the refresh token revoked and signs out of Supabase |

Password login (`bcrypt`-hashed, with per-password salt) and phone OTP verification remain implemented in `auth-service` and are used for seeded test and administrator accounts, but the web UI now presents Google as the only interactive sign-in method.

## 4.2 Authorization & Role Management

**Three roles**, carried in the JWT `role` claim and enforced at four independent layers.

| Role | Capabilities |
|---|---|
| `CUSTOMER` | Search, book, pay, cancel, view own tickets/notifications/wallet |
| `OPERATOR` | Everything a customer can do, plus manage own buses, routes, trips, transit routes, deals, manifests, analytics and passenger notifications |
| `ADMIN` | Platform-wide: user role management, notices, broadcasts, transactions, audit log, bank administration |

**Layer 1 — Route guard (UX).** `ProtectedRoute` in the SPA redirects unauthenticated users to `/login` and users of the wrong role back to `/`. This layer is convenience only and is assumed to be bypassable.

**Layer 2 — Token verification (every service).** Each service has its own `api/deps.py` that decodes and validates the JWT locally:

```python
def get_current_user_payload(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("user_id") is None:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception
```

**Layer 3 — Role enforcement (declarative).** `require_role()` produces a FastAPI dependency that rejects a mismatched role with `403`:

```python
def require_role(required_role: UserRole):
    def role_checker(payload: dict = Depends(get_current_user_payload)):
        if payload.get("role") != required_role.value:
            raise HTTPException(status_code=403, detail="Operation not permitted")
        return payload
    return role_checker

@router.post("/trips/", dependencies=[Depends(require_role(UserRole.OPERATOR))])
```

**Layer 4 — Ownership checks (object level).** Being an authenticated customer is not enough to read *someone else's* booking. Queries are scoped to the caller, so an attacker substituting another user's UUID gets `404`, not data:

```python
query = select(Booking).where(Booking.id == booking_id, Booking.user_id == user_id)
```

The same pattern guards payments, tickets, cancellations and notifications. Operator-scoped resources are additionally filtered by the operator that owns them.

**Role assignment rules.** New users may self-select only `CUSTOMER` or `OPERATOR` on the web; mobile registration creates `CUSTOMER` only. `ADMIN` can never be chosen by a client — it is granted either by `PATCH /api/admin/users/{id}/role` from an existing administrator, or by a controlled database update for the first bootstrap account.

## 4.3 Security Measures

### Input validation

- **Pydantic schemas on every endpoint.** Types, formats (`EmailStr`, `UUID`, `date`, `time`), bounds and required fields are validated before a handler runs; violations return `422` with a field-level error report. This eliminates an entire class of injection and type-confusion bugs at the edge.
- **Business-rule validation in the booking hot path**, none of which trusts the client: 1–4 seats per booking; no duplicate seats; one passenger record per seat and the sets must match exactly; the trip must exist and be `SCHEDULED`; the operator id must match the trip's; boarding and dropping points must be members of the route's declared points; and the fare must equal the server-computed total within 0.01.
- **Frontend validation** with React Hook Form + Zod gives immediate feedback but is treated purely as UX — every rule is re-checked server-side.

### Injection & XSS protection

- **SQL injection:** all database access goes through SQLAlchemy's ORM/expression language with bound parameters. There is no string-concatenated SQL in service code.
- **XSS:** React escapes interpolated content by default, and the app does not use `dangerouslySetInnerHTML`. `DOMPurify` is present in the bundle via the PDF/HTML-canvas toolchain.
- **Path traversal:** ticket files are addressed by `booking_id` (a UUID) and resolved inside a fixed `FILE_STORAGE_PATH`; user input never forms a filesystem path.
- **Password storage:** `bcrypt` with a per-password salt; hashes are never returned by any endpoint.

### Rate limiting & abuse control

| Control | Where |
|---|---|
| Max **3 payment attempts** per user per trip, after which seats are definitively released and an audit event is written | `payment-service` |
| **Idempotency keys** on booking and payment creation, preventing duplicate charges from retries or double-clicks | `booking-service`, `payment-service` |
| **Seat lock TTL** (600 s) so an abandoned checkout cannot hold inventory indefinitely | `inventory-service` (Redis) |
| **Booking expiry** (10 min) enforced by an APScheduler job that publishes `seat.lock.expired` | `booking-service` |
| **Promo usage caps** — global `max_uses` plus a per-user Redis marker preventing reuse | `deals-service` |
| **Kong `retries: 3` + passive health checks**, which trip a failing upstream out of rotation (a crude circuit breaker against request floods hitting a sick instance) | Kong |
| **Per-host circuit breaker** (5 failures → open 30 s) on all inter-service calls | `shared/http_client.py` |

> **Not yet implemented:** a general per-IP/per-user request rate limit at the gateway. Kong ships a `rate-limiting` plugin that would be enabled declaratively in `kong.yml`; this is listed as a known gap in §4.4 and §8.3.

### Transport security

- **HTTPS everywhere in production.** System Nginx terminates TLS for `busgo.farefin.com` using a Let's Encrypt certificate provisioned by Certbot; the browser never speaks plain HTTP to the API.
- **Internal traffic** stays on the private Docker bridge network (`busgo-network`); only Nginx's 80/443 are exposed publicly on the VM.

### Secrets management — an honest assessment

**What is done correctly:**

- `.env` is in `.gitignore`, and **no `.env` file is committed** to the repository.
- Every service ships a committed `.env.example` documenting the variables it needs *without* their values (13 services do this).
- The frontend receives configuration as Vite **build arguments** (`VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) rather than baked-in literals in source.
- Mobile apps read `EXPO_PUBLIC_*` variables from an untracked `.env`, with a committed `.env.example`.
- The Supabase key used by clients is the **publishable/anon** key, which is designed to be public and is constrained by row-level security on the Supabase side.
- Docker Compose reads most infrastructure values through `${VAR:-default}` interpolation, so an operator can override everything from `infrastructure/.env` (untracked).

**What is *not* done correctly, stated plainly:**

> **Verification result: credentials ARE currently hardcoded in the committed `busgo/infrastructure/docker-compose.yml`.** Specifically:
>
> 1. The **Supabase PostgreSQL connection string, including the database password**, is written literally as the `DATABASE_URL` default for all 13 database-backed services.
> 2. **`JWT_SECRET: supersecretkey`** is a literal in every service's environment block — a guessable signing key that would let anyone forge an `ADMIN` token.
> 3. The **Supabase project URL and anon key** appear as literal `${VAR:-<literal>}` defaults.
> 4. **Grafana's admin credentials** are `admin`/`admin`.
> 5. `postgres` for local development uses `user`/`password`.
>
> This is the single most serious finding in this report, and it is recorded here rather than glossed over because the template explicitly asks for verification. The repository is public, so these values must be treated as **compromised**.

**Remediation plan (the values must be rotated, not just moved):**

1. Rotate the Supabase database password and regenerate the Supabase keys.
2. Replace `JWT_SECRET` with a 32-byte random value (`openssl rand -hex 32`), different per environment. Rotating it invalidates all existing tokens, which is the desired effect.
3. Change the Grafana admin password.
4. Strip every literal default from `docker-compose.yml`, leaving bare `${DATABASE_URL}`, `${JWT_SECRET}` etc., so Compose fails loudly if a variable is missing instead of silently falling back to a committed secret.
5. Move the real values into `busgo/infrastructure/.env` on the server (untracked, `chmod 600`).
6. Store the deployment-time values as **GitHub Actions secrets** when the CI pipeline in §6.1 is built, injecting them at deploy time.
7. Purge the historical values from git history (`git filter-repo`) or, more practically given they are already public, accept the rotation in step 1–3 as the mitigation.

### Other hardening applied

- **Ownership scoping** on every personal-data query (§4.2, layer 4).
- **Audit trail** — booking, payment, cancellation and detected-fraud events are published to `audit.log` and persisted append-only in `audit_logs`, indexed by event type, entity, user and time.
- **Correlation IDs** on every request, propagated across services, making a suspicious sequence traceable end to end in Loki.
- **Readiness gating** — a service whose database or Redis is unreachable reports `503` and is pulled from rotation rather than serving errors.
- **Cache-control headers** on the SPA shell and an explicit `Clear-Site-Data: "cache"` on `/login`, added after stale login bundles from the password era were being served from browser cache (§5.3, BUG-05).

## 4.4 Known Vulnerabilities & Mitigations

Presented in descending severity. Items marked **OPEN** are real, current weaknesses.

| # | Vulnerability | Severity | Status | Impact & Mitigation |
|---|---|---|---|---|
| V-01 | **Hardcoded secrets in `docker-compose.yml`** — Supabase DB password, `JWT_SECRET=supersecretkey`, Supabase keys, Grafana `admin/admin`, in a public repository | **Critical** | **OPEN** | Anyone can forge an admin JWT or connect directly to the production database. Mitigation: the 7-step rotation plan in §4.3. Nothing else in this table matters until V-01 is closed. |
| V-02 | **`allow_origins=["*"]` with `allow_credentials=True`** in every service's CORS middleware | **High** | **OPEN** | Any origin may call the API with credentials. In practice tokens are sent as `Authorization` headers rather than cookies, which blunts it, but the combination is invalid per the CORS spec and should be replaced with an explicit allow-list (`https://busgo.farefin.com`, `http://localhost:5173`, the Expo dev origins). |
| V-03 | **Internal endpoints reachable through the public gateway** — `inventory` lock/release/confirm/unbook, `deals` `apply-promo`, `search` `reindex`, `payments` `mock/simulate-failure` require no authentication | **High** | **OPEN** | A caller who knows a `trip_id` could lock seats directly or force a reindex. Mitigations available today: mark these routes internal-only in `kong.yml` (no public route, service-to-service traffic stays on the Docker network), or require a shared service token. They were left open to keep the seat-race and load tests dependency-free — a testing convenience with a real cost. |
| V-04 | **`audit-service` role check is a stub** — `verify_admin_role()` returns `True` unconditionally | **High** | **OPEN** | The audit log is readable by anyone who can reach `/api/audit/audit/logs`. Fix: replace the stub with the standard `require_role(UserRole.ADMIN)` dependency used elsewhere. |
| V-05 | **No gateway rate limiting** | **Medium** | **OPEN** | Brute-force and scraping are unthrottled. Application-level limits exist for the money paths (3 payment attempts, promo caps, seat TTLs), but a general limit needs Kong's `rate-limiting` plugin, which is a declarative addition to `kong.yml`. |
| V-06 | **Access tokens in `localStorage` + cookies on the web** | **Medium** | Accepted | Vulnerable to XSS in principle. Mitigated by React's default escaping, no `dangerouslySetInnerHTML`, a 15-minute token TTL, and server-side revocable refresh tokens. The stronger fix — `httpOnly` refresh cookies — was deferred because it does not translate to the React Native clients. |
| V-07 | **Bank PINs stored in plaintext** with a default of `1234` | **Medium** | Accepted (simulation) | `bank-service` simulates an MFS provider for demonstration; no real money moves. If it were ever real, PINs would need the same `bcrypt` treatment as passwords. Documented rather than hidden. |
| V-08 | **Mock payment gateways** with a `simulate-failure` toggle exposed | **Medium** | Accepted (simulation) | Acceptable in a lab project, but the toggle must not exist in a production build. |
| V-09 | **Cross-service references are not FK-enforced** | **Low** | By design | Inherent to database-per-service. Consistency is maintained by the saga, compensation logic and events; the residual risk is orphaned rows after a partial failure, which the audit log makes detectable. |
| V-10 | **Sensitive detail in error responses** — some handlers return raw exception text (e.g. `f"Failed to lock seats: {str(e)}"`) | **Low** | **OPEN** | Leaks internal structure. Fix: log the detail with the correlation ID and return a generic message to the client. |
| V-11 | **`ALTER TABLE` statements run on service startup** instead of versioned migrations | **Low** | **OPEN** | Idempotent, so it is safe, but it means schema changes are not reviewable or reversible as artefacts. Alembic is the intended fix (§8.3). |
| V-12 | **Broad OAuth redirect wildcard `exp://**`** allowed in Supabase for Expo Go testing | **Low** | Documented | `GOOGLE_AUTH_SETUP.md` explicitly instructs removing this wildcard before a production release. |

**Resolved during development:** JWT signature verification was confirmed enforced on every protected route; ownership scoping was added after an early version allowed reading another user's booking by UUID; the payment amount check and the attempt cap were added after manual tampering tests (§5.3, BUG-03).

---
# 5. Testing & Quality Assurance

## 5.1 Testing Strategy

Testing a system of 14 services, three clients and four pieces of infrastructure could not be done meaningfully with per-service unit tests alone — the interesting failures in this architecture are *between* services (a seat race, a saga rollback, a gateway routing a request to a dead replica), and none of them are visible from inside a single process. The strategy therefore prioritises **black-box tests that drive the running stack through Kong**, exactly the way a real client does, over white-box tests of individual functions.

### Test levels

| Level | What it covers | Tooling | Location |
|---|---|---|---|
| **Contract / schema (automatic)** | Every request and response body is validated against a Pydantic model at runtime; a malformed payload fails with `422` before any handler runs | FastAPI + Pydantic v2 | built into all 14 services |
| **Static type checking** | Compile-time correctness of the web SPA and both mobile apps | `tsc -b` (web build), `npm run typecheck` (mobile, operator) | CI-able, run per commit |
| **Integration / unit (service level)** | Liveness, readiness (PostgreSQL + Redis reachability) and smoke endpoints for all 14 services, through the gateway | custom Python runner, standard library only | `busgo/tests/run_tests.py unit` |
| **Load balancing / infrastructure** | Whether Kong's ring balancer actually spreads a burst across replicas, and whether upstream health is as reported | same runner + Kong Admin API | `run_tests.py load`, `run_tests.py status` |
| **Concurrency (the critical correctness test)** | N users racing for the *same* seat — exactly one must win | `ThreadPoolExecutor`, true parallel requests | `run_tests.py concurrency` |
| **End-to-end feature (transit saga)** | Multi-leg itinerary search and all-or-nothing journey booking with compensation | same runner | `run_tests.py transit` |
| **Manual E2E / exploratory** | Full user journeys on web and both mobile apps, across all three roles | Chrome DevTools, Expo Go, Android device | recorded in §5.3 / §5.4 |
| **API-level manual testing** | Every endpoint of every service, with copy-pasteable commands | `curl` + `jq` | `busgo/tests/curl_commands.md` |
| **Observability-assisted verification** | Grafana dashboards and Loki queries used to confirm event flow and latency after changes | Prometheus / Grafana / Loki | `:8515` |

### Why a custom runner rather than pytest

`busgo/tests/run_tests.py` is a **dependency-free** (standard library only) runner deliberately:

- It needs **no `pip install`**, so any team member — or an evaluator — can run the full suite against a deployed stack from a bare Python 3.8+ install.
- It is **environment-agnostic**: `KONG_URL=… KONG_ADMIN_URL=… python run_tests.py all` points the same suite at localhost, a teammate's machine, or the Azure VM.
- It **exits non-zero on failure**, so it is CI-ready the moment a pipeline exists (§6.1).
- All knobs — the 14 services and their prefixes, expected replica counts, smoke endpoints, burst size, number of racing users, transit fixtures — live in `config.json`, so extending coverage is a data change, not a code change.

Its honest limitation is that it is a **black-box integration suite, not a unit-test framework**: it produces pass/fail counts, not line coverage, and it requires the stack to be running.

### Running the suite

```bash
cd busgo/tests

python run_tests.py            # everything (default)
python run_tests.py unit       # liveness + readiness + smoke for all 14 services
python run_tests.py load       # load-balancing distribution across replicas
python run_tests.py concurrency# N users racing for the SAME seat
python run_tests.py transit    # multi-leg itinerary search + journey saga
python run_tests.py status     # current replica health via the Kong Admin API

# point the same suite anywhere
KONG_URL=https://busgo.farefin.com python run_tests.py all
```

## 5.2 Test Coverage Summary

### Automated suite

| Suite | Assertions | What is asserted |
|---|---|---|
| **Liveness** | 14 | `GET /api/{svc}/health` → `200` and `status == "ok"` for all 14 services |
| **Readiness** | 14 | `GET /api/{svc}/health/ready` → `200` and `status == "ready"`, with `database` and `redis` both `ok`; a broken dependency must yield `503` |
| **Smoke endpoints** | 6 | Real business reads return `200`: deals promos, flash sales, operator list, trip list, city list, transit search |
| **Load balancing** | 3 targets × 45 requests | 45 requests at concurrency 10 against `auth`, `search`, `booking`; distinct `instance` values counted to prove round-robin across replicas |
| **Upstream health** | 14 upstreams | Kong Admin API reports every target `HEALTHY` |
| **Seat concurrency** | 8 parallel users | Exactly **1** lock succeeds (`200`); the other **7** are rejected (`409`); zero unexpected statuses |
| **Transit** | itinerary search + journey booking | Itineraries returned with valid transfer windows; a journey either books every leg or holds none |
| **Total automated assertions** | **~100 per full run** | |

### Functional coverage by area

| Area | Automated | Manual E2E | Notes |
|---|---|---|---|
| Service health & readiness (14/14) | ✅ Full | ✅ | Also continuously exercised by Kong's active checks every 5 s |
| Gateway routing (14/14 prefixes) | ✅ Full | ✅ | Both plural and singular prefixes verified |
| Load balancing / replica failover | ✅ Full | ✅ | Replica killed manually to confirm rerouting |
| **Seat locking under contention** | ✅ Full | ✅ | The highest-risk invariant in the system |
| Transit itinerary search | ✅ | ✅ | |
| Transit journey saga + compensation | ✅ | ✅ | Compensation verified by forcing a leg-2 conflict |
| Authentication (Google, refresh, logout) | ➖ | ✅ Full | Interactive OAuth is not automatable with the current runner |
| Role-based authorisation (3 roles) | ➖ | ✅ Full | Verified per role against operator/admin endpoints |
| Booking creation & fare validation | ➖ | ✅ Full | Includes deliberate fare/operator/point tampering |
| Payment + fraud checks | ➖ | ✅ Full | Amount mismatch, 4th attempt, idempotent retry |
| Refunds & cancellation policy | ➖ | ✅ Full | Inside and outside the 1-hour window |
| Promo codes & flash sales | ➖ | ✅ Full | Expiry, usage cap, per-user reuse, minimum fare |
| Ticket QR/PDF generation & validation | ➖ | ✅ Full | Including one ticket per transit leg |
| Notifications (26 types, 3 roles) | ➖ | ✅ Partial | Inbox, unread badge, read/read-all/delete verified |
| Operator CRUD (buses/routes/trips/transit) | ➖ | ✅ Full | |
| Admin dashboard, roles, notices, audit | ➖ | ✅ Full | |
| Mobile passenger app (16 screens) | ➖ | ✅ Full | Tracked in `mobile/MOBILE_WEB_PARITY_AUDIT.md` |
| Mobile operator app (12 screens) | ➖ | ✅ Full | |

### Static analysis

| Check | Scope | Status |
|---|---|---|
| `tsc -b` (strict TypeScript) | Web SPA — runs as part of `npm run build`, so **a type error fails the Docker image build** | ✅ Passing |
| `npm run typecheck` | Mobile app, operator app | ✅ Passing |
| `npx expo-doctor` | Mobile app, operator app — dependency/SDK compatibility | ✅ Passing |
| `eslint` | Web SPA | Configured (`npm run lint`) |

### Coverage gaps — stated honestly

- **No line-coverage instrumentation.** There is no `pytest --cov` figure to report, because there is no per-service unit-test suite to instrument. Quoting a coverage percentage would be fabrication. What *is* measurable is that all 14 services, all 14 gateway routes and the two hardest concurrency invariants are covered by automated black-box assertions on every run.
- **Interactive OAuth is untested automatically** — the Google consent screen cannot be driven by the current runner. Playwright with a stored session state would close this.
- **No frontend component tests.** React Testing Library / Vitest tests for `ProtectedRoute`, the refresh-queue interceptor and the seat-selection reducer are the highest-value additions (§8.3).
- **The suite requires a running stack**, so it cannot run as a pure unit stage in CI without first bringing up Compose (feasible with `docker compose up -d` in a GitHub Actions job).

## 5.3 Bug Tracking & Resolution Log

Issues were tracked through GitHub Issues, branch-per-fix pull requests and the running notes in `busgo/docs/`. The table below is the substantive log — every entry is a real defect that was found and fixed during development, with the resolution as it exists in the codebase today.

| ID | Severity | Description | Root cause | Resolution | Status |
|---|---|---|---|---|---|
| BUG-01 | **Critical** | Two users could occasionally book the same seat under load | Availability was checked and then written in two separate steps — a classic check-then-act race | Introduced an atomic Redis lock, `SET seat_lock:{trip}:{seat} {booking} NX EX 600`, as the arbiter, with the DB row as the durable record. Regression test: `run_tests.py concurrency` (8 users, exactly 1 winner) | ✅ Fixed |
| BUG-02 | **Critical** | Multi-leg journeys could leave leg 1 locked forever when leg 2 failed | No compensation path in the journey creation flow | Implemented the saga in `routers/journeys.py`: legs are locked in order and any failure releases everything already held before returning `409` with "no seats were held" | ✅ Fixed |
| BUG-03 | **Critical** | A user could edit the fare in the request body and pay less than the ticket price | The server trusted the client's `total_fare` | `booking-service` now re-fetches the trip from `operator-service` and rejects mismatched fare, operator, trip status or boarding/dropping point; `payment-service` independently re-checks the amount against the booking and emits a `fraud.detected` audit event | ✅ Fixed |
| BUG-04 | **Critical** | Every service crash-looped and the whole platform returned `502` | Services opened their Kafka producer/consumer at startup and raised if the broker was absent; Kafka itself died on restart with a Zookeeper `NodeExists` error | Made Kafka connection best-effort where it is not on the critical path (e.g. `bank-service` logs and continues), added `restart: unless-stopped` to every infrastructure service, and documented the recovery procedure | ✅ Fixed |
| BUG-05 | **High** | Returning users hit a blank or broken login page after the switch to Google-only sign-in | Nginx had served the old password-era login bundle with `immutable` caching, so browsers replayed obsolete JS | Added `no-store` headers for the SPA shell and an explicit `Clear-Site-Data: "cache"` on `/login`, deliberately preserving storage so valid sessions survive | ✅ Fixed |
| BUG-06 | **High** | Multi-row inserts failed on the deployed stack but worked locally | Supabase's PgBouncer runs in transaction pooling mode, which breaks `asyncpg`'s prepared-statement caching used by SQLAlchemy's `executemany` | Set `use_insertmanyvalues=False` on the booking engine and disabled statement caching for the pooled connection | ✅ Fixed |
| BUG-07 | **High** | Bus search returned `500` after any full stack recreate | Elasticsearch has no persistent volume, so the `bus_trips` index disappeared with the container | Added `POST /api/search/reindex` to rebuild the index from operator data, and documented it as a post-recreate step. *(Attaching a volume to Elasticsearch is the proper fix — §8.3.)* | ✅ Fixed (workaround) |
| BUG-08 | **High** | Four services were marked `UNHEALTHY` by Kong and removed from rotation despite being fine | Their `/health` route was shadowed by a greedy `/{id}` route registered earlier, so health checks got `401`/`422` | Registered the health router **before** any router with a root path parameter, in ticket, booking, payment and cancellation services; made it a documented convention | ✅ Fixed |
| BUG-09 | **High** | `notification-service` restarted continuously | `scheduler.py` imported `requests`, which was missing from its `requirements.txt` | Added the dependency and rebuilt the image | ✅ Fixed |
| BUG-10 | **High** | Every request crashed with `AttributeError` after adding Prometheus metrics | `prometheus-fastapi-instrumentator` resolves route names by iterating `app.routes`, which is incompatible with this FastAPI version's lazy `_IncludedRouter` objects | Wrote a small middleware in `shared/observability.py` using `prometheus_client` directly, with low-cardinality labels (service/method/status, no raw path). The library is now banned in the codebase conventions | ✅ Fixed |
| BUG-11 | **High** | Kong kept routing to a single replica after scaling up | Kong cached the Docker DNS record and never saw the new A-records | Set `KONG_DNS_RESOLVER: 127.0.0.11` and `KONG_DNS_STALE_TTL: 4`; documented `docker exec infrastructure-kong-1 kong reload` after scaling | ✅ Fixed |
| BUG-12 | **High** | Valid users were logged out at random | The Axios interceptor logged out on *any* refresh failure, including transient network errors and 5xx | The store now clears the session only when the refresh is genuinely rejected (400/401/403 or no refresh token); everything else preserves the session for retry | ✅ Fixed |
| BUG-13 | **High** | A session established in one browser tab left other tabs on an expired token | Zustand's in-memory state does not follow `localStorage` writes from another tab | Added a `storage` event listener that rehydrates the store when `busgo-auth` changes | ✅ Fixed |
| BUG-14 | **High** | Google sign-in on Android never returned to the app | The OAuth callback deep link was not registered/handled for the native build | Registered `busgo://auth/callback`, handled it via `expo-linking`, and documented the full redirect matrix in `GOOGLE_AUTH_SETUP.md` | ✅ Fixed |
| BUG-15 | **High** | New Google accounts were created but could not act | On first Google login the account was inserted without being activated/linked correctly, and customers without a phone number could not reach checkout | Link by verified e-mail preserving the existing role; route phone-less customers to a one-time `PhoneSetup`/profile step before checkout so the wallet can be provisioned | ✅ Fixed |
| BUG-16 | **Medium** | Operators signed in with Google could not create routes | The operator-scoped route creation path assumed a password-era operator profile | Fixed operator profile resolution for Google-authenticated operators | ✅ Fixed |
| BUG-17 | **Medium** | A retried payment debited the account twice | No idempotency on the payment path | `payment-service` now returns the original `COMPLETED` payment (and re-publishes `payment.completed`) instead of debiting again | ✅ Fixed |
| BUG-18 | **Medium** | Booking history showed each leg of a transit journey as an unrelated booking | The UI had no notion of a journey grouping | `GET /bookings/my` and the UI group legs by `journey_id`, showing transfer points and one ticket per leg | ✅ Fixed |
| BUG-19 | **Medium** | Payment history was empty and a declined payment left the UI stuck | The history query and the declined-state handling were both wrong | Fixed the query and added an explicit declined state with a retry path | ✅ Fixed |
| BUG-20 | **Medium** | Expo Go could not load the mobile app | The app targeted Expo SDK 54 while the installed Expo Go was SDK 57 | Upgraded the SDK, pinned `expo-constants`, added the missing `babel-preset-expo`, and shipped a matching `Expo-Go-57.0.2.apk` for demos | ✅ Fixed |
| BUG-21 | **Medium** | Containers failed to bind on Windows development machines | Windows reserves the 8081–8180 and 8519–8618 port ranges (Hyper-V dynamic ports) | Standardised host ports on the 85xx/81xx scheme outside the reserved ranges, made every port `${VAR:-default}`-overridable, and documented the constraint | ✅ Fixed |
| BUG-22 | **Medium** | Services showed stale behaviour after code edits | Source is bind-mounted, so a rebuild is unnecessary — but a restart is still required for Python to re-import | Documented: `docker restart <container>` for code changes; `--build` only for new pip dependencies | ✅ Documented |
| BUG-23 | **Medium** | Containers were OOM-killed during builds on the 2-vCPU Azure VM | Building 14 images plus Elasticsearch and Kafka exhausted RAM | Added a 4 GB swap file, built the frontend first to avoid network/CPU contention, and staggered container startup in `setup_server.sh` | ✅ Fixed |
| BUG-24 | **Low** | `/api/ticket/docs` returned `404` while `/api/tickets/docs` worked | Kong declared only plural prefixes | Added singular aliases for the main resources in `kong.yml` | ✅ Fixed |
| BUG-25 | **Low** | Database URL with a password containing `'` failed to parse | The password was not percent-encoded in the connection string | Percent-encoded the credential in all `DATABASE_URL` values | ✅ Fixed |
| BUG-26 | **Low** | Booking status enum values drifted between services | Each service had defined its own copy | Centralised in `shared/enums.py`, plus one-off SQL repair scripts kept in `infrastructure/` for the already-written rows | ✅ Fixed |

**Open items** carried forward as known issues rather than silently closed: **V-01** (hardcoded secrets), **V-02** (wildcard CORS with credentials), **V-03** (unauthenticated internal endpoints), **V-04** (`audit-service` role stub), **V-05** (no gateway rate limiting), and the deferred UI work noted in the transit plan (the per-trip `allow_transit` toggle inside `ManageTrips.tsx` and the operator manifest view — both already reachable through the API).

## 5.4 Sample Test Cases

### TC-01 — Seat concurrency: no double-booking under contention *(automated, highest value)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-01 — concurrency / integration |
| **Objective** | Prove that when N users request the *same* seat simultaneously, exactly one succeeds |
| **Preconditions** | Stack running; at least one trip with an available seat |
| **Command** | `python run_tests.py concurrency` |
| **Steps** | 1. Discover a trip and an available seat. 2. Generate 8 distinct `booking_id`s. 3. Fire 8 `POST /api/inventory/trips/{trip}/seats/lock` requests **in parallel** via `ThreadPoolExecutor(max_workers=8)`. 4. Classify responses. 5. Release the winner's lock (cleanup). |
| **Expected** | Exactly **1** response `200`; exactly **7** responses `409`; **0** other statuses |
| **Actual** | 1 winner, 7 rejected, 0 errors — `[PASS] Exactly 1 winner and 7 correctly rejected — no double-booking.` |
| **Result** | ✅ **PASS** |
| **Why it matters** | This is the single invariant whose violation would make the product unusable. It is also the reason Redis is in the architecture at all. |

### TC-02 — Load balancing across replicas *(automated)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-02 — infrastructure / load |
| **Objective** | Verify Kong's ring balancer distributes traffic across replicas |
| **Preconditions** | `docker compose up -d --scale auth-service=3 --scale search-service=3 --scale booking-service=3`; `kong reload` afterwards |
| **Command** | `python run_tests.py load` |
| **Steps** | For each of `auth`, `search`, `booking`: issue 45 `GET /health` requests at concurrency 10 and count distinct `instance` values |
| **Expected** | ≥ 2 distinct instances per target (ideally 3, roughly evenly distributed); all responses `200` |
| **Actual** | 3 distinct container ids per target, ~15 requests each |
| **Result** | ✅ **PASS** |
| **Note** | If only one instance answers immediately after scaling, Kong is holding a stale DNS record — `docker exec infrastructure-kong-1 kong reload` (BUG-11) |

### TC-03 — Readiness reflects real dependency state *(automated)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-03 — integration |
| **Objective** | `/health/ready` must distinguish "process alive" from "dependencies reachable" |
| **Steps** | 1. `GET /api/bookings/health/ready` → expect `200`, `{"database":"ok","redis":"ok"}`. 2. `docker stop infrastructure-redis-1`. 3. Repeat. 4. Restart Redis and repeat. |
| **Expected** | `200 ready` → `503` with `redis` failing → `200 ready`; Kong removes and then restores the target |
| **Actual** | As expected; Kong's active check removed the target within ~15 s and restored it within ~5 s |
| **Result** | ✅ **PASS** |

### TC-04 — Transit journey saga rolls back completely *(automated + manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-04 — end-to-end / saga |
| **Objective** | A multi-leg booking must be all-or-nothing |
| **Preconditions** | A seeded connecting itinerary (Dhaka → Cumilla → Sylhet) |
| **Steps** | 1. `GET /api/transit/search?origin=Dhaka&destination=Sylhet&journey_date=…` → itineraries. 2. Occupy every seat on leg 2 from a second session. 3. `POST /api/bookings/journeys/` with both legs. 4. Re-read leg 1's seat map. |
| **Expected** | `409`; **no** seats held on leg 1; journey marked `FAILED`; the user sees "no seats were held" |
| **Actual** | `409` returned; leg 1's seats were released by the compensation path and showed `AVAILABLE` |
| **Result** | ✅ **PASS** |

### TC-05 — Fare tampering is rejected *(manual, security)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-05 — security / negative |
| **Objective** | The server must not accept a client-supplied fare |
| **Steps** | 1. Log in as a customer, select seats on a trip whose true total is BDT 1,720. 2. Intercept `POST /api/bookings/` and change `total_fare` to `100.0`. 3. Submit. 4. Then create the booking legitimately, intercept `POST /api/payments/initiate` and change `amount`. |
| **Expected** | Step 3 → `400 "Fare changed; refresh the trip and try again"`. Step 4 → `400 "Payment amount does not match booking fare"` plus a `fraud.detected` entry in `audit_logs` |
| **Actual** | Both rejected; the audit event was present in `GET /api/audit/audit/logs?event_type=fraud.detected` |
| **Result** | ✅ **PASS** |

### TC-06 — Payment attempt cap releases the seats *(manual, security)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-06 — security / negative |
| **Objective** | Repeated failed payments must not let one user block inventory indefinitely |
| **Steps** | Create a booking, then attempt payment 4 times with an incorrect PIN / insufficient balance |
| **Expected** | Attempts 1–3 → `400` decline; attempt 4 → `403 "Maximum payment attempts exceeded for this trip"`, `payment.failed` published, and the held seats returned to `AVAILABLE` |
| **Actual** | As expected; the seat map showed the seats free again within seconds |
| **Result** | ✅ **PASS** |

### TC-07 — Idempotent booking and payment *(manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-07 — reliability |
| **Objective** | A retried request must not create a second booking or a second debit |
| **Steps** | 1. `POST /api/bookings/` twice with the identical `idempotency_key`. 2. Complete payment. 3. Replay `POST /api/payments/initiate` for the same booking. 4. Check the bank ledger. |
| **Expected** | One booking (the second call returns the cached response, `"Retrieved from cache"`); one `COMPLETED` payment returned on replay; exactly one `DEBIT` row |
| **Actual** | As expected — a single booking, a single debit |
| **Result** | ✅ **PASS** |

### TC-08 — Ownership scoping (horizontal privilege escalation) *(manual, security)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-08 — security / authorisation |
| **Objective** | User A must not read user B's data |
| **Steps** | As user A, request user B's `booking_id`, `payment_id`, `ticket_id` and notification id |
| **Expected** | `404` (not `403`, to avoid confirming the resource exists); no data disclosed |
| **Actual** | `404` in all four cases |
| **Result** | ✅ **PASS** |

### TC-09 — Role gate on operator/admin endpoints *(manual, security)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-09 — security / authorisation |
| **Objective** | Role claims must be enforced server-side, not only in the SPA |
| **Steps** | 1. With a `CUSTOMER` token, call `POST /api/operators/trips/` and `GET /api/admin/dashboard-stats`. 2. Navigate directly to `/admin` in the browser. 3. With an `OPERATOR` token, call an `ADMIN` endpoint. |
| **Expected** | `403` from the API in every case; the SPA redirects to `/` |
| **Actual** | As expected. **Exception found:** `GET /api/audit/audit/logs` returned `200` for a non-admin — logged as **V-04** |
| **Result** | ⚠️ **PASS with one finding** |

### TC-10 — Expired token refresh and queue replay *(manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-10 — authentication |
| **Objective** | An expired access token must refresh transparently without losing in-flight requests |
| **Steps** | 1. Sign in and wait > 15 minutes. 2. Trigger a page that fires several parallel requests. 3. Observe the network panel. 4. Separately, revoke the refresh token and retry. |
| **Expected** | One `401`, one `/refresh`, then all queued requests replayed successfully with the new token; after revocation, a clean redirect to `/login` |
| **Actual** | Exactly one refresh call; all parallel requests replayed; revocation redirected correctly |
| **Result** | ✅ **PASS** |

### TC-11 — Google sign-in preserves an existing role *(manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-11 — authentication |
| **Objective** | Linking a Google identity to an existing account must not downgrade its role |
| **Steps** | 1. Seed an `OPERATOR` with e-mail X. 2. Sign in with Google using the same e-mail. 3. Inspect the returned user and try an operator-only action. |
| **Expected** | `provider_subject` linked; `role` still `OPERATOR`; operator actions succeed; the client is redirected to `/operator` |
| **Actual** | As expected |
| **Result** | ✅ **PASS** |

### TC-12 — Promo code rules *(manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-12 — business logic / negative |
| **Objective** | Every promo constraint must hold |
| **Steps** | Apply, in turn: a valid code; an expired code; a code below its `min_fare`; a code already used by this user; a code at its `max_uses`; an inactive code |
| **Expected** | Valid → discount applied and reflected in the amount due. Others → `valid:false` with the specific reason ("not valid at this time", "Minimum fare required is …", "already used this promo code", "usage limit reached", "inactive") |
| **Actual** | All six behaved as specified; the discount was **persisted server-side**, so `payment-service`'s amount check used the reduced fare |
| **Result** | ✅ **PASS** |

### TC-13 — Seat hold expiry *(manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-13 — reliability / scheduler |
| **Objective** | An abandoned checkout must return its seats to the pool |
| **Steps** | Create a booking, abandon it, and observe the seat map and booking status over the next 10+ minutes |
| **Expected** | UI countdown from 10:00; at expiry the booking becomes `EXPIRED`, `seat.lock.expired` is published, and the seats become `AVAILABLE`; the Redis key disappears at TTL regardless |
| **Actual** | Seats returned to the pool; the booking showed as expired on reload |
| **Result** | ✅ **PASS** |

### TC-14 — Cancellation and refund policy *(manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-14 — business logic |
| **Objective** | Refund amount must follow the stated policy and actually credit the wallet |
| **Steps** | 1. `GET /api/bookings/{id}/cancellation-info` for a booking > 1 h before departure. 2. Cancel. 3. Check seats, wallet balance and notifications. 4. Repeat inside the 1-hour window. |
| **Expected** | 80 % refund quoted and credited outside the window; seats unbooked; `refund.initiated` published; a `REFUND_INITIATED` notification appears; inside the window the reduced/blocked policy is quoted **before** the user commits |
| **Actual** | As expected; the bank ledger showed a matching `CREDIT` row |
| **Result** | ✅ **PASS** |

### TC-15 — QR e-ticket generation and validation *(manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-15 — end-to-end |
| **Objective** | Every confirmed booking yields a scannable ticket; a transit journey yields one per leg |
| **Steps** | 1. Complete a 2-leg journey payment. 2. Open both tickets, download the PDFs. 3. `POST /api/tickets/validate-qr` with a valid code, then a tampered one, then the valid one again. |
| **Expected** | Two tickets with distinct QR payloads; PDFs render with passenger, seat, route and time; valid → accepted; tampered → rejected; re-scan → flagged as already used |
| **Actual** | As expected |
| **Result** | ✅ **PASS** |

### TC-16 — Operator "fill empty seats" campaign *(manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-16 — feature / end-to-end |
| **Objective** | An operator can find and notify likely buyers for unsold seats |
| **Steps** | 1. As an operator with a partly empty trip, open **Fill Empty Seats**. 2. `POST /api/bookings/trips/{id}/interested-passengers`. 3. Send the offer. 4. Log in as one of those passengers. |
| **Expected** | Only users with a matching `travel_records` corridor are listed; each receives an in-app notification with the offer; the unread badge increments within one 30-second poll |
| **Actual** | As expected |
| **Result** | ✅ **PASS** |

### TC-17 — Real-time data sync without a page refresh *(manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-17 — data sync (§2.4.4) |
| **Objective** | Database-side changes must surface in an open UI unaided |
| **Steps** | 1. Passenger keeps a seat map open in tab A. 2. A second user locks a seat in tab B. 3. Operator creates a new trip; passenger re-runs the search. 4. Operator broadcasts a notification. |
| **Expected** | (2) the seat greys out on the next refetch without reload; (3) the new trip appears, proving `trip.created` → Elasticsearch propagation; (4) the bell badge increments within 30 s |
| **Actual** | All three observed |
| **Result** | ✅ **PASS** |

### TC-18 — Guest browsing and deferred authentication *(manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-18 — UX / authorisation |
| **Objective** | Browsing must not require an account; checkout must |
| **Steps** | Signed out, browse routes, deals, search results, transit itineraries and a live seat map; then attempt to continue to passenger details |
| **Expected** | Everything browsable; the checkout step redirects to `/login` and returns to the exact same step after sign-in |
| **Actual** | As expected on both web and mobile |
| **Result** | ✅ **PASS** |

### TC-19 — Replica failure is transparent *(manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-19 — resilience |
| **Objective** | Killing one replica must not produce user-visible errors |
| **Steps** | With `auth-service` at 3 replicas under a light request loop, `docker kill` one; observe responses and `run_tests.py status` |
| **Expected** | No `5xx` reaches the client (Kong retries against a healthy target); the killed target shows `UNHEALTHY` within ~15 s and returns after restart |
| **Actual** | As expected; a small latency blip on the requests that were retried |
| **Result** | ✅ **PASS** |

### TC-20 — Mobile ↔ web parity *(manual)*

| Field | Detail |
|---|---|
| **ID / Type** | TC-20 — cross-platform |
| **Objective** | A booking made on one client is fully usable on the other |
| **Steps** | Book a transit journey in the Expo app; open the same account on the web; cancel from the web; return to the app and pull to refresh |
| **Expected** | Identical journey grouping, tickets and balances on both; the cancellation and refund are reflected in the app after refresh |
| **Actual** | As expected — both clients read the same services through Kong |
| **Result** | ✅ **PASS** |

---

# 6. CI/CD & Deployment

## 6.1 Pipeline Overview

**Current state, stated honestly: there is no automated CI/CD pipeline in the repository.** There is no `.github/workflows/` directory, no GitHub Actions, and no hosted build runner. Deployment is **script-driven and repeatable, but manually triggered**. Presenting a GitHub Actions pipeline here would misrepresent what the links actually show.

What *does* exist is a scripted, idempotent deployment path plus several automated quality gates that run at build time:

```mermaid
flowchart LR
    A["Developer commits<br/>on feature branch"] --> B["Local gates<br/>tsc -b · npm run typecheck<br/>npx expo-doctor"]
    B --> C["Pull request to main<br/>peer review"]
    C --> D["Merge to main"]
    D --> E["SSH to Azure VM<br/>manual trigger"]
    E --> F["./setup_server.sh"]
    F --> G["git reset --hard origin/main"]
    G --> H["docker compose build<br/>frontend first, then services"]
    H --> I{"Build gate:<br/>tsc -b inside<br/>frontend Dockerfile"}
    I -- "type error" --> X["Image build FAILS<br/>deployment aborts"]
    I -- "clean" --> J["docker compose up -d<br/>staggered startup"]
    J --> K["Nginx + Certbot<br/>TLS for busgo.farefin.com"]
    K --> L["Verify:<br/>python run_tests.py all"]
    L --> M["Grafana / Loki<br/>post-deploy observation"]
```

### Automated gates that do run

| Gate | Trigger | Effect on failure |
|---|---|---|
| `tsc -b` (strict TypeScript) | Inside `frontend/Dockerfile` as part of `npm run build` | **The Docker image fails to build and the deployment aborts** — a genuine, enforced gate |
| `npm run typecheck` / `npx expo-doctor` | `npm run verify` in both mobile apps | Blocks the Expo/EAS build |
| Pydantic schema validation | Every request at runtime | `422` before any handler executes |
| Kong active health checks | Every 5 s, continuously | An unhealthy instance is removed from rotation automatically |
| `run_tests.py all` | Manually after each deploy | Non-zero exit signals a broken deploy |

### The pipeline that should exist (designed, not yet built)

`run_tests.py` was written to be CI-ready — standard library only, environment-overridable, non-zero exit on failure — so the missing piece is only the workflow file:

```yaml
# .github/workflows/ci.yml  — designed, not yet committed
name: BusGo CI/CD
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd busgo/frontend && npm ci && npx tsc -b && npm run lint
      - run: cd busgo/mobile   && npm ci && npm run typecheck
      - run: cd busgo/operator && npm ci && npm run typecheck

  integration:
    runs-on: ubuntu-latest
    needs: typecheck
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f busgo/infrastructure/docker-compose.yml up -d --build
        env:                                   # secrets injected, never committed
          DATABASE_URL:      ${{ secrets.DATABASE_URL }}
          JWT_SECRET:        ${{ secrets.JWT_SECRET }}
          SUPABASE_URL:      ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      - run: sleep 90 && curl -X POST http://localhost:8085/api/search/reindex
      - run: KONG_URL=http://localhost:8085 python busgo/tests/run_tests.py all

  deploy:
    runs-on: ubuntu-latest
    needs: integration
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.AZURE_HOST }}
          username: ${{ secrets.AZURE_USER }}
          key: ${{ secrets.AZURE_SSH_KEY }}
          script: cd ~/Jaabo && ./setup_server.sh
```

Adopting this would also close **V-01**, since every secret would move into GitHub Actions secrets and out of `docker-compose.yml`.

## 6.2 Environments

Three environments are in use. They are configured by **environment variables only** — the same images and the same Compose file run everywhere.

### Development (local workstation)

| Aspect | Configuration |
|---|---|
| Orchestration | `docker compose -f busgo/infrastructure/docker-compose.yml up -d` |
| Web frontend | Vite dev server on `http://localhost:5173`, HMR enabled |
| API entry | Kong on `http://localhost:18085` (`KONG_PORT`) |
| Database | Either the local `postgres:15-alpine` container (13 databases created by `init-multiple-databases.sh`) or the shared Supabase instance |
| Source loading | Service directories are **bind-mounted** into containers, so a code edit needs `docker restart <container>`, not a rebuild |
| `ENVIRONMENT` | `development` — verbose logging, Swagger UI exposed |
| Mobile | Expo Go against the workstation's LAN address (`EXPO_PUBLIC_API_URL=http://192.168.x.x:18085`); the port must be open in the firewall |
| Observability | Prometheus `:8514`, Grafana `:8515`, Loki `:8516` |

**Host port map** (all overridable; chosen to avoid the Windows-reserved 8081–8180 and 8519–8618 ranges — BUG-21):

| Component | Var | Default | Component | Var | Default |
|---|---|---|---|---|---|
| Kong proxy | `KONG_PORT` | 8085 | Ticket | `TICKET_SERVICE_PORT` | 8106 |
| Kong admin | `KONG_ADMIN_PORT` | 8089 | Notification | `NOTIFICATION_SERVICE_PORT` | 8107 |
| Frontend | `FRONTEND_PORT` | 8083 | Cancellation | `CANCELLATION_SERVICE_PORT` | 8108 |
| PostgreSQL | `POSTGRES_PORT` | 8086 | Operator | `OPERATOR_SERVICE_PORT` | 8109 |
| Redis | `REDIS_PORT` | 8087 | Deals | `DEALS_SERVICE_PORT` | 8110 |
| Kafka | `KAFKA_PORT` | 8088 | Admin | `ADMIN_SERVICE_PORT` | 8111 |
| Elasticsearch | — | 9200 | Audit | `AUDIT_SERVICE_PORT` | 8112 |
| Inventory | `INVENTORY_SERVICE_PORT` | 8103 | Bank | `BANK_SERVICE_PORT` | 8113 |
| Payment | `PAYMENT_SERVICE_PORT` | 8105 | Transit | `TRANSIT_SERVICE_PORT` | 8517 |
| Prometheus | `PROMETHEUS_PORT` | 8514 | Grafana | `GRAFANA_PORT` | 8515 |
| Loki | `LOKI_PORT` | 8516 | | | |

`auth-service`, `search-service` and `booking-service` deliberately publish **no** host port so they can be scaled to multiple replicas without port collisions — they are reachable only through Kong, which is the point.

### Staging

No separate staging host was provisioned — an honest consequence of a single-VM budget. The staging role is filled by the **`feature/*` branch + local full-stack run** workflow: a feature is brought up locally with the identical Compose file and validated with `run_tests.py all` before its pull request is merged. The gap this leaves (no production-like data volume, no TLS-path testing before production) is acknowledged in §8.3.

### Production

| Aspect | Configuration |
|---|---|
| Host | Azure Linux VM, Ubuntu, public IP `135.171.216.245` |
| Domain | `busgo.farefin.com` |
| TLS | Let's Encrypt certificate issued and renewed by Certbot |
| Edge | System Nginx: `/` → frontend container `:8083`, `/api/` → Kong `:8085`, forwarding `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` |
| Orchestration | The same `docker-compose.yml`, with `restart: unless-stopped` on every service |
| Database | Supabase managed PostgreSQL through the PgBouncer pooler (port 6543, transaction mode) |
| Frontend build args | `VITE_API_BASE_URL=https://busgo.farefin.com`, plus the Supabase URL/anon key |
| Memory | 4 GB swap file provisioned by `setup_server.sh` to survive image builds (BUG-23) |
| Startup | Frontend built first, then services staggered, to avoid CPU/network contention |
| `ENVIRONMENT` | `development` — **a known misconfiguration**: it should be `production` so that Swagger and verbose logging can be disabled on the public host |

## 6.3 Deployment Steps

Deployment is one idempotent script, `setup_server.sh`, safe to re-run.

### First-time provisioning

```bash
ssh <user>@135.171.216.245
git clone https://github.com/TAUSEEF-01/Jaabo.git ~/Jaabo
cd ~/Jaabo
chmod +x setup_server.sh
./setup_server.sh          # installs Docker, then exits and asks you to re-login
# log out, log back in (docker group membership), then:
./setup_server.sh
```

The script performs, in order:

| Step | Action |
|---|---|
| 0 | Create and enable a **4 GB swap file** (prevents OOM during image builds) and persist it in `/etc/fstab` |
| 1 | Install Docker CE, CLI, containerd, buildx and the Compose plugin from Docker's apt repository; add the user to the `docker` group |
| 2 | Ensure Git is installed |
| 3 | Clone the repository, or `git fetch` + `git reset --hard origin/main` if it already exists |
| 4 | Write `/etc/nginx/sites-available/busgo`, enable it, remove the default site, `nginx -t` and reload |
| 5 | Obtain/renew the TLS certificate with `certbot --nginx -d busgo.farefin.com` |
| 6 | `docker compose down`, **build the frontend first**, then build and start the remaining services with staggered startup |

### Routine redeploy (after merging to `main`)

```bash
ssh <user>@135.171.216.245
cd ~/Jaabo && ./setup_server.sh
```

### Manual/partial operations

```bash
cd ~/Jaabo/busgo/infrastructure

# rebuild one service (needed only when its pip dependencies changed)
sudo docker compose up -d --build booking-service

# code-only change (source is bind-mounted) — restart is enough
sudo docker restart infrastructure-booking-service-1

# scale and refresh Kong's DNS cache
sudo docker compose up -d --scale auth-service=3 --scale search-service=3 --scale booking-service=3
sudo docker exec infrastructure-kong-1 kong reload

# re-seed the Elasticsearch index after a full recreate (BUG-07)
curl -X POST https://busgo.farefin.com/api/search/reindex

# status and logs
sudo docker compose ps
sudo docker compose logs -f booking-service
```

### Post-deployment verification checklist

```bash
# 1. every service is live and ready
KONG_URL=https://busgo.farefin.com python busgo/tests/run_tests.py unit

# 2. the seat-locking invariant still holds
KONG_URL=https://busgo.farefin.com python busgo/tests/run_tests.py concurrency

# 3. transit search and the journey saga
KONG_URL=https://busgo.farefin.com python busgo/tests/run_tests.py transit

# 4. the SPA and Swagger are reachable over TLS
curl -I https://busgo.farefin.com
curl -s https://busgo.farefin.com/api/auth/health | jq
```

Then confirm in a browser: sign in with Google, run a search, open a seat map, complete a payment with a seeded wallet, and check that the ticket and notification appear.

### Mobile app distribution

```bash
cd busgo/mobile
npm ci && npm run verify          # typecheck + expo-doctor
npx eas build --platform android  # or: npm run export:android
```

The repository also ships `busgo/mobile/Expo-Go-57.0.2.apk` so a demo device can load the project in Expo Go without an SDK-version mismatch (BUG-20).

## 6.4 Hosting Platform & Live URL

| Item | Value |
|---|---|
| **Live application** | **https://busgo.farefin.com** |
| Host | Azure Linux VM (Ubuntu), public IP `135.171.216.245` |
| Edge | System Nginx + Let's Encrypt (Certbot), HTTPS |
| Runtime | Docker Compose — 14 FastAPI services, Kong, PostgreSQL/Supabase, Redis, Kafka + Zookeeper, Elasticsearch, Prometheus, Grafana, Loki, Promtail, Nginx-served SPA |
| API base | `https://busgo.farefin.com/api` |
| Swagger | `https://busgo.farefin.com/api/{service}/docs` (§3.3) |
| Grafana | `http://135.171.216.245:8515` *(not exposed through the domain; see the note below)* |
| Prometheus | `http://135.171.216.245:8514` |
| Mobile passenger app | Expo build / `Expo-Go-57.0.2.apk` in `busgo/mobile/` |
| Mobile operator app | Expo build from `busgo/operator/` |

### Credentials required to access full functionality

**Primary sign-in is Google OAuth** — an evaluator can sign in with any Google account and will receive a `CUSTOMER` role, which is enough to search, book, pay (with a provisioned demo wallet) and receive a ticket.

Seeded accounts for the roles that cannot be self-assigned:

| Role | Phone | Password | Reaches |
|---|---|---|---|
| Admin | `01700000001` | `Test@123` | `/admin` — dashboard, user roles, notices, transactions, audit |
| Operator | `01700000002` | `Test@123` | `/operator` — buses, routes, trips, transit routes, deals, analytics, fill-empty-seats |
| Customer | `01700000000` | `Test@123` | Full passenger flow with booking history |

| Service | Credentials |
|---|---|
| Grafana dashboards | `admin` / `admin` |
| Demo wallet PIN (bKash / Nagad / bank) | `1234` |

> **Before submission, complete these three items:**
> 1. **Rotate every credential in §4.3/V-01** and re-deploy, then update this table with the new demo passwords.
> 2. **Confirm the VM is running and the stack is up**, and re-run the §6.3 verification checklist — the report is graded against what the links actually serve.
> 3. If Grafana is to be shown to evaluators, either expose it behind the domain with a strong password or provide a screenshot in the Appendix instead of a live link.

## 6.5 Monitoring & Logging

A complete observability stack ships with the platform in the same Compose file — it is treated as a feature, not an afterthought.

### Metrics — Prometheus + Grafana

Every service calls `setup_observability(app, SERVICE_NAME)` at startup, which installs a middleware exposing `GET /metrics`:

| Metric | Type | Labels |
|---|---|---|
| `http_requests_total` | Counter | `service`, `method`, `status` |
| `http_request_duration_seconds` | Histogram | `service`, `method` |

Labels are deliberately **low cardinality** — no raw path — so the time series count stays bounded. Prometheus scrapes all 14 services plus Kong's internal status listener (`0.0.0.0:8100`, kept off the host to avoid the Windows-reserved range). Grafana is **provisioned as code**: `infrastructure/grafana/provisioning/` declares the Prometheus and Loki datasources and the `busgo-overview.json` dashboard, so a fresh stack comes up with working dashboards and no manual clicking.

The dashboard covers request rate per service, error rate (`status >= 500`), latency distribution, and per-instance traffic — which is how load balancing across replicas was verified visually alongside TC-02.

### Logs — structured JSON → Promtail → Loki → Grafana

- Every service emits **one JSON object per log line**, including `service`, `request_id`, level, timestamp and message (`pythonjsonlogger`).
- **Promtail** tails the Docker socket and ships all container logs to **Loki**.
- Loki is queryable from the same Grafana instance, so a metric spike can be pivoted directly to the log lines behind it.

### Correlation IDs — tracing without a tracer

The system does not run Jaeger/OpenTelemetry, but it achieves most of the practical benefit far more cheaply:

1. Kong's correlation-id plugin sets `X-Request-ID` on the inbound request (or the middleware generates one).
2. The middleware stores it in a `ContextVar`, so every log line in that request automatically carries it.
3. `ResilientClient` attaches the same header to every outbound inter-service call.
4. The header is echoed on the response, so a user-reported failure can be traced with one Loki query:

```logql
{job="containerlogs"} | json | request_id="a1b2c3d4-…"
```

This returns the full path of one user action across Kong → booking → operator → inventory → payment → bank.

### Health monitoring

| Layer | Mechanism |
|---|---|
| Liveness | `GET /health` on all 14 services, including the `instance` (container id) |
| Readiness | `GET /health/ready` — `200` only if PostgreSQL **and** Redis respond, else `503` with the failing check named |
| Gateway active checks | Kong polls `/health` every 5 s; 3 consecutive failures mark a target unhealthy; 1 success restores it |
| Gateway passive checks | 5 HTTP failures / 3 TCP failures / 3 timeouts trip a target out of rotation — a circuit breaker at the edge |
| Automatic recovery | `restart: unless-stopped` on every container; `retries: 3` re-dispatches a failed request to a healthy target |
| Operational view | `python run_tests.py status` prints live upstream/target health from the Kong Admin API |

### Audit logging

Distinct from operational logging: business-significant events (`booking.created`, `payment.completed`, `booking.cancelled`, `refund.initiated`, `fraud.detected`) are published to the `audit.log` Kafka topic and persisted append-only in `audit_logs`, indexed by event type, entity id, user id and timestamp, and queryable by administrators through `/api/audit/audit/logs`.

### Gaps

- **No alerting.** Prometheus has no Alertmanager rules; failures are noticed by looking. Alert rules on error rate, latency and target health are the obvious next step.
- **No distributed tracing spans** — correlation IDs give the path, but not per-hop timing breakdowns.
- **No log retention policy** — Loki uses its default local storage on a single VM.

---
# 7. Repository & Documentation Quality

**Repository:** https://github.com/TAUSEEF-01/Jaabo

## 7.1 Branching Strategy & Commit Conventions

### Branching strategy

A **feature-branch workflow** with `main` as the single always-deployable trunk:

```
main                    ← protected trunk; production deploys from here
├── feature/google-authentication   ← shipped via PR #2
├── tauseef                         ← personal integration branch
├── tamzid                          ← personal integration branch
└── tbt                             ← personal integration branch
```

| Branch | Purpose |
|---|---|
| `main` | Always deployable. `setup_server.sh` does `git reset --hard origin/main`, so whatever is on `main` *is* production. |
| `feature/<name>` | A discrete feature developed in isolation and merged through a pull request — e.g. `feature/google-authentication`, which added Google sign-in across web and mobile and merged as **PR #2**. |
| `<developer-name>` | Per-developer branches (`tauseef`, `tamzid`, `tbt`) used for parallel work on a shared codebase where four people were frequently touching adjacent files. |

**Merge practice.** Substantial features went through pull requests with review (`Merge pull request #2 from TAUSEEF-01/feature/google-authentication`). Integration merges are explicit merge commits, preserving the branch topology (`Merge mobile Google authentication and complete passenger app`, `Merge latest origin/main before deployment`), so the history shows how parallel work converged rather than flattening it.

### Commit conventions — an honest assessment

The repository contains **163 commits on `main`**. The convention is best described as *aspirational rather than enforced*:

**What was done well.** The commits that matter most are genuinely descriptive, imperative-mood, single-purpose messages:

```
Implement transit (multi-leg / connecting-bus) journeys
Add Google authentication across web and mobile
Fix asyncpg prepared statement caching issue with PgBouncer
Fix passenger transit journeys and multi-bus tickets
mobile: upgrade Expo SDK 54 -> 57 so Expo Go can load the app
chore: stagger container startup in setup_server.sh
feat: improve operator transit route management
Fix: add restart unless-stopped policies to all infrastructure services
Redesign mobile app and add web-parity features
Show full bus details in user bookings
```

Several use **Conventional Commits** prefixes (`feat:`, `chore:`, `fix:`) and scope prefixes (`mobile:`), and reference the problem *and* the reason — `Fix asyncpg prepared statement caching issue with PgBouncer` is exactly the message a future maintainer needs.

**What was not.** A substantial fraction of commits are messages such as `updated`, `update` and `updated` again. These carry no information: they do not say what changed, why, or which subsystem was touched. Bisecting a regression through a run of twelve consecutive `updated` commits is materially harder than it needed to be, and the git history is therefore less useful as documentation than the code itself is.

**What we would enforce next time:** Conventional Commits (`type(scope): summary`) validated by a `commit-msg` hook (commitlint/husky) so an uninformative message cannot be committed at all, plus branch protection on `main` requiring a passing CI run and one approving review. This is a process gap, not a knowledge gap — the good messages prove the team knew what a useful commit message looks like.

## 7.2 README Completeness Checklist

The root `README.md` documents the platform, and specialised documentation lives beside the code it describes.

| Item | Status | Where |
|---|---|---|
| Project overview / what it does | ✅ | `README.md` — one-paragraph description of the platform and its stack |
| Prerequisites | ✅ | `README.md` — Docker & Compose, Node 20+, Python 3.12+ |
| Setup steps | ✅ | `README.md` Quick Start — `make up`, `make migrate`, `make seed`, frontend `npm install && npm run dev` |
| Run commands | ✅ | `Makefile` (`up`, `down`, `logs`, `migrate`, `seed`, `test`) |
| Test commands | ✅ | `busgo/tests/README.md` — all five suites with per-suite explanations and tuning knobs |
| Service/route map | ✅ | `README.md` — table of all services with their Kong route base and description |
| Test credentials | ✅ | `README.md` — admin/operator/customer logins |
| Architecture overview | ✅ | `README.md` — proxy, database-per-service, Kafka events, Redis cache |
| Environment variables | ⚠️ **Partial** | 13 committed `.env.example` files document per-service variables, and `GOOGLE_AUTH_SETUP.md` documents the auth variables — but the **root README does not consolidate them**, and there is no single "copy these files, set these values" section |
| API documentation | ✅ | Swagger per service (§3.3) + `busgo/tests/curl_commands.md` with runnable examples for every service |
| Screenshots | ❌ **Missing** | No images in the README; the Appendix of this report is where the UI is shown |
| Feature list | ⚠️ Partial | Comprehensive for mobile (`busgo/mobile/README.md`, `MOBILE_WEB_PARITY_AUDIT.md`); the root README lists services rather than user-facing features |
| Deployment instructions | ⚠️ Partial | `setup_server.sh` is self-documenting and idempotent, but the README does not describe the production deploy path |
| Contributing / branching guide | ❌ Missing | The branching model in §7.1 is observable from history but not written down |
| License | ❌ Missing | No `LICENSE` file |
| File encoding | ⚠️ | `README.md` is UTF-16LE, which renders as spaced-out characters in some tools — should be converted to UTF-8 |

### Supporting documentation that *is* strong

| Document | What it provides |
|---|---|
| `busgo/docs/TRANSIT_TRANSPORTATION_PLAN.md` | An exceptional 400+ line design document: the problem in plain words, a locked architecture-decision table, exact constants, **a codebase-conventions-and-gotchas section**, and phased acceptance criteria. It is written so that an engineer with no prior context can execute it. |
| `busgo/tests/README.md` | Explains each test suite, what "load balancing" means here, how to point the suite at another host, and how to tune it. |
| `busgo/tests/curl_commands.md` | Copy-pasteable `curl` for every service, including the transit saga and the seat race. |
| `busgo/GOOGLE_AUTH_SETUP.md` | Full OAuth setup: Google console, Supabase providers, every redirect URL for web/native/Expo Go, and the role-preservation rule. |
| `busgo/mobile/README.md` + `MOBILE_WEB_PARITY_AUDIT.md` | Implemented-feature list, configuration, development workflow, and a web-parity audit. |
| `busgo/Database Models Guide.md`, `all_models.txt` | Data model reference. |
| Inline module docstrings | `shared/health.py`, `shared/observability.py`, `shared/http_client.py` and `routers/journeys.py` each open with a usage-oriented docstring explaining *why*, not just what — including the note on why `prometheus-fastapi-instrumentator` is banned. |

**Priority fixes:** (1) convert `README.md` to UTF-8; (2) add a consolidated environment-variable table and a `.env` bootstrap section; (3) embed 6–8 screenshots; (4) add `LICENSE` and `CONTRIBUTING.md`; (5) document the production deployment path in the README rather than only in the script.

## 7.3 Code Organization / Folder Structure

```
Jaabo/
├── README.md                       # platform overview, quick start, service map, test credentials
├── Makefile                        # up / down / logs / migrate / seed / test
├── setup_server.sh                 # idempotent production deployment (Azure VM)
├── deploy.ps1, deploy_to_server.ps1, start_jaabo.{sh,bat}   # local/dev convenience scripts
├── SRS_BusGo.tex, busgo_srs_v1.pdf # software requirements specification
├── scaffold*.py, fix_*.py          # one-off generators and data-repair utilities
│
└── busgo/
    ├── services/                   # ── 14 independently deployable FastAPI services ──
    │   ├── auth-service/           #    identity, JWT, Google exchange, OTP
    │   ├── search-service/         #    Elasticsearch trip search
    │   ├── transit-service/        #    multi-leg itinerary graph search (stateless)
    │   ├── inventory-service/      #    seat inventory + Redis distributed locks
    │   ├── booking-service/        #    booking + journey saga orchestration
    │   ├── payment-service/        #    payment, mock gateways, fraud checks, refunds
    │   ├── bank-service/           #    simulated accounts and ledger
    │   ├── ticket-service/         #    QR + PDF ticket generation and validation
    │   ├── cancellation-service/   #    cancellation requests and refund policy
    │   ├── operator-service/       #    operators, buses, routes, trips, transit routes
    │   ├── deals-service/          #    promo codes and flash sales
    │   ├── notification-service/   #    event fan-out, in-app inbox, scheduler, templates
    │   ├── admin-service/          #    platform dashboard, roles, notices
    │   └── audit-service/          #    append-only audit trail
    │       └── (each service:)
    │           ├── main.py         #    FastAPI app, CORS, observability, health, startup
    │           ├── core/config.py  #    pydantic-settings, env-driven
    │           ├── api/deps.py     #    get_current_user_payload(), require_role()
    │           ├── routers/        #    HTTP layer
    │           ├── services/       #    domain + integration layer
    │           ├── models/         #    SQLAlchemy models
    │           ├── schemas/        #    Pydantic request/response models
    │           ├── Dockerfile
    │           ├── requirements.txt
    │           └── .env.example
    │
    ├── shared/                     # ── mounted into every container at /app/shared ──
    │   ├── base_response.py        #    {success, data, message, errors} envelope
    │   ├── enums.py                #    BookingStatus, UserRole, PaymentMethod, …
    │   ├── exceptions.py           #    domain exceptions (e.g. SeatAlreadyLocked)
    │   ├── health.py               #    create_health_router() — liveness + readiness
    │   ├── observability.py        #    /metrics, JSON logging, X-Request-ID
    │   ├── http_client.py          #    ResilientClient — retries, backoff, circuit breaker
    │   ├── kafka_producer.py       #    publish()
    │   ├── kafka_consumer.py       #    consumer base
    │   └── database_config.py      #    shared engine/session configuration
    │
    ├── frontend/                   # ── React 18 + TypeScript + Vite web SPA ──
    │   ├── src/{pages,components,notifications,stores,api,hooks,layout,lib,utils}
    │   ├── Dockerfile              #    multi-stage: node build → nginx serve
    │   ├── nginx.conf              #    SPA routing + cache-control policy
    │   └── vite.config.ts, tailwind.config.js, tsconfig.json
    │
    ├── mobile/                     # ── Expo / React Native passenger app (16 screens) ──
    │   ├── src/{screens,components,api,store,lib,utils,types}
    │   ├── MOBILE_WEB_PARITY_AUDIT.md
    │   └── app.json, eas.json, babel.config.js
    │
    ├── operator/                   # ── Expo / React Native operator app (12 screens) ──
    │   └── src/{screens,components,api,store,lib,utils}
    │
    ├── infrastructure/             # ── infrastructure as code ──
    │   ├── docker-compose.yml      #    the entire topology in one file
    │   ├── kong/kong.yml           #    declarative routes, upstreams, health checks
    │   ├── postgres/init-multiple-databases.sh
    │   ├── kafka/init-topics.sh
    │   ├── prometheus/prometheus.yml
    │   ├── loki/loki-config.yml, promtail/promtail-config.yml
    │   ├── grafana/provisioning/   #    datasources + busgo-overview dashboard as code
    │   ├── seed.py, seed_*.sql     #    seed data
    │   └── fix_*.sql               #    one-off schema repairs (see BUG-26)
    │
    ├── tests/                      # ── black-box suite driven through Kong ──
    │   ├── run_tests.py            #    unit | load | concurrency | transit | status
    │   ├── config.json             #    services, replicas, smoke endpoints, knobs
    │   ├── test_data.json, curl_commands.md, README.md
    │   └── run_all.sh / run_all.ps1
    │
    ├── docs/TRANSIT_TRANSPORTATION_PLAN.md
    ├── GOOGLE_AUTH_SETUP.md
    └── Database Models Guide.md, all_models.txt
```

### Organising principles

1. **Vertical slices, not horizontal layers, at the top level.** The repository is split by *service*, then by layer inside each service. A change to booking touches one directory.
2. **The same internal layout in every service** (`main → core → api → routers → services → models → schemas`), so moving between services costs nothing.
3. **Genuinely shared code lives in exactly one place** and is bind-mounted, so health checks, metrics, the response envelope and the resilient HTTP client cannot drift between services.
4. **Infrastructure is code**, versioned beside the application — Compose, Kong routes, Prometheus scrape config, Loki, Promtail and even the Grafana dashboard.
5. **Feature-module organisation on the frontend** where a feature has real weight — `src/notifications/` holds its own API client, store and components together.
6. **Tests are a first-class top-level directory**, not scattered per service, because the interesting tests are cross-service by nature.

### Known organisational debt

- Root-level one-off scripts (`fix_enums.py`, `fix_kafka.py`, `update_script.py`, `scaffold_*.py`, `test_*.py`, `temp.txt`, `scratch/`) should move into a `tools/` directory or be deleted; they clutter the first impression of the repository.
- `services/*/models.py` and `services/*/models/` coexist in a few services — a leftover from an early refactor.
- `deals-service` and `audit-service` define routes directly in `main.py` rather than in `routers/`, and `deals-service` does not use the shared response envelope.
- `busgo/frontend/dist/` and `node_modules` artefacts are present in the working tree; `dist/` should be ignored.

## 7.4 Local Setup Instructions

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Docker Desktop / Engine + Compose v2 | latest | Allocate **≥ 8 GB RAM** — the stack runs 14 services plus Kafka and Elasticsearch |
| Node.js | 20.19.4+ | Web SPA and both mobile apps |
| Python | 3.12+ (3.8+ for the test runner only) | |
| Git | any recent | |
| Free host ports | 8083, 8085–8089, 8103–8113, 8514–8517, 9200 | On Windows, avoid 8081–8180 and 8519–8618 (Hyper-V reserved) — BUG-21 |

### 1. Clone

```bash
git clone https://github.com/TAUSEEF-01/Jaabo.git
cd Jaabo
```

### 2. Configure environment variables

```bash
# per-service variables
for f in busgo/services/*/.env.example; do cp "$f" "$(dirname "$f")/.env"; done

# frontend and mobile
cp busgo/frontend/.env.example busgo/frontend/.env
cp busgo/mobile/.env.example   busgo/mobile/.env
```

Create `busgo/infrastructure/.env` for the infrastructure values (this file is untracked by design):

```env
# --- required ---
DATABASE_URL=postgresql+asyncpg://<user>:<url-encoded-password>@<host>:6543/postgres
JWT_SECRET=<generate with: openssl rand -hex 32>
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your publishable key>

# --- optional port overrides (defaults shown) ---
KONG_PORT=18085
KONG_ADMIN_PORT=18089
FRONTEND_PORT=8083
POSTGRES_PORT=8086
REDIS_PORT=8087
KAFKA_PORT=8088
TRANSIT_SERVICE_PORT=8517
PROMETHEUS_PORT=8514
GRAFANA_PORT=8515
LOKI_PORT=8516
```

`busgo/frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:18085
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your publishable key>
```

> To run entirely locally without Supabase, point `DATABASE_URL` at the bundled Postgres container (`postgresql+asyncpg://user:password@postgres:5432/<service>_db`); `init-multiple-databases.sh` creates all 13 databases on first start. Google sign-in will be unavailable, so use the seeded password accounts.

### 3. Start the stack

```bash
make up          # equivalent to: cd busgo/infrastructure && docker-compose up -d
```

This starts PostgreSQL, Redis, Kafka + Zookeeper, Elasticsearch, Kong, all 14 services and the observability stack. First run takes several minutes while images build.

```bash
docker compose -f busgo/infrastructure/docker-compose.yml ps   # wait until all are Up
```

### 4. Seed data and build the search index

```bash
make seed                                              # operators, buses, routes, trips, users
curl -X POST http://localhost:18085/api/search/reindex # populate the Elasticsearch bus_trips index
```

> The reindex step is **required** — Elasticsearch has no persistent volume, so search returns `500` until the index is built (BUG-07).

### 5. Run the web frontend

```bash
cd busgo/frontend
npm install
npm run dev            # http://localhost:5173
```

### 6. Verify

```bash
cd busgo/tests
python run_tests.py            # full suite: unit + load + concurrency + transit + status
python run_tests.py unit       # quickest confidence check
```

Expected: all 14 services report liveness and readiness `ok`, the smoke endpoints return `200`, and the seat-concurrency test reports exactly one winner.

### 7. Optional — scale and observe

```bash
cd busgo/infrastructure
docker compose up -d --scale auth-service=3 --scale search-service=3 --scale booking-service=3
docker exec infrastructure-kong-1 kong reload      # refresh Kong's DNS cache
cd ../tests && python run_tests.py load            # watch requests spread across replicas
```

Then open **Grafana** at `http://localhost:8515` (`admin`/`admin`) for the pre-provisioned BusGo overview dashboard, and **Prometheus** at `http://localhost:8514`.

### 8. Optional — run the mobile apps

```bash
cd busgo/mobile           # or busgo/operator
npm install
npm run verify            # typecheck + expo-doctor
npm start                 # scan the QR code with Expo Go
```

Set `EXPO_PUBLIC_API_URL` to the workstation's **LAN address** (e.g. `http://192.168.0.42:18085`), not `localhost` — the phone cannot resolve the computer's loopback. The port must also be allowed through the workstation firewall.

### Sign in

| Role | Phone | Password |
|---|---|---|
| Customer | `01700000000` | `Test@123` |
| Admin | `01700000001` | `Test@123` |
| Operator | `01700000002` | `Test@123` |

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Everything returns `502` | Kafka is down and services are crash-looping | `docker ps -a \| grep kafka`; restart Kafka, then the services |
| Search returns `500` | Elasticsearch index missing | `curl -X POST http://localhost:18085/api/search/reindex` |
| Code edits have no effect | Source is bind-mounted; Python must re-import | `docker restart <container>` (use `--build` only for new pip dependencies) |
| Only one replica ever answers | Kong cached a stale DNS record | `docker exec infrastructure-kong-1 kong reload` |
| Port bind failure on Windows | Hyper-V reserved range | Choose ports outside 8081–8180 and 8519–8618 |
| A service is `UNHEALTHY` in Kong | `/health` shadowed by a greedy `/{id}` route | Register the health router before that router (BUG-08) |
| `503` on `/health/ready` | PostgreSQL or Redis unreachable | The response names the failing check |

---

# 8. Evaluation & Reflection

## 8.1 Web Performance & Core Web Vitals

### Measured build output (verified from the production build)

These figures are read directly from the committed production build (`busgo/frontend/dist/assets/`) and are the basis of the analysis below:

| Asset | Size (uncompressed) | Notes |
|---|---|---|
| `index-BOoKBfnj.js` | **1,827,671 B (1.79 MB)** | The single application bundle — React, Router, React Query, Zustand, Axios, Leaflet, jsPDF, html2canvas, QR, date-fns, all 27 pages |
| `index.es-Dy3hdNWM.js` | 150,731 B (147 KB) | Vendor ES chunk (PDF toolchain) |
| `purify.es-dhnUglUx.js` | 24,291 B (24 KB) | DOMPurify (pulled in by the PDF/HTML-canvas path) |
| `index-4LdiYs8I.css` | 122,128 B (119 KB) | Tailwind output |
| **Total transferred (uncompressed)** | **≈ 2.08 MB** | roughly **550–650 KB** over the wire with Nginx gzip |

**The finding this produces is unambiguous: the SPA ships as one monolithic JavaScript bundle with no route-level code splitting.** `App.tsx` imports all 27 page components statically, so a visitor landing on the home page downloads and parses the admin portal, the operator analytics screens, the PDF generator and the Leaflet map before the first screen is interactive. On a mid-tier mobile device over 4G, parsing ~1.8 MB of JavaScript is the dominant cost in Total Blocking Time, and it delays Largest Contentful Paint.

### Core Web Vitals

> **These fields must be filled by running the measurement before submission — no numbers are invented here.** Run Lighthouse (Chrome DevTools → Lighthouse → Mobile, Performance) against `https://busgo.farefin.com`, or use PageSpeed Insights, and record the results:

| Metric | Target (Google "good") | Measured — Home `/` | Measured — Search `/search` | Measured — Seat map |
|---|---|---|---|---|
| First Contentful Paint (FCP) | ≤ 1.8 s | **[run Lighthouse]** | | |
| Largest Contentful Paint (LCP) | ≤ 2.5 s | **[run Lighthouse]** | | |
| Total Blocking Time (TBT) | ≤ 200 ms | **[run Lighthouse]** | | |
| Cumulative Layout Shift (CLS) | ≤ 0.1 | **[run Lighthouse]** | | |
| Speed Index | ≤ 3.4 s | **[run Lighthouse]** | | |
| Performance score | ≥ 90 | **[run Lighthouse]** | | |

```bash
# reproducible command-line measurement
npx lighthouse https://busgo.farefin.com \
  --preset=desktop --output=html --output-path=./report/lighthouse-desktop.html
npx lighthouse https://busgo.farefin.com \
  --form-factor=mobile --throttling-method=simulate \
  --output=html --output-path=./report/lighthouse-mobile.html
```

Given the measured 1.79 MB main bundle, the honest expectation is a **poor-to-moderate mobile Performance score dominated by TBT and LCP**, with CLS likely good (the layout is Tailwind-driven with stable containers) and TTFB good (Nginx serving static files from the same VM, behind TLS).

### Optimisations already in place

| Optimisation | Where | Effect |
|---|---|---|
| **Production build with minification and tree shaking** | Vite/Rollup (`npm run build`) | Dead code eliminated, output minified |
| **Content-hashed filenames** | Vite | Enables long-lived immutable caching without staleness |
| **Immutable caching for static assets** — `expires 1y; Cache-Control: public, immutable` for JS/CSS/images/fonts | `frontend/nginx.conf` | Repeat visits fetch **zero** JS/CSS |
| **No-store on the HTML shell** | `frontend/nginx.conf` | A deploy is picked up immediately; no stale-shell/fresh-asset mismatch |
| **Gzip compression** | Nginx defaults | ~3.5× reduction on text assets |
| **Multi-stage Docker build** | `frontend/Dockerfile` | Only the static `dist/` reaches the runtime image (Nginx Alpine) |
| **Server-side caching of hot data** | Redis (seat locks, idempotency, promo state) | Removes repeated database round-trips from the checkout path |
| **Elasticsearch for search** | `search-service` | Sub-100 ms trip queries instead of multi-table SQL scans |
| **Client-side caching + deduplication** | TanStack React Query | Repeated navigations serve from cache; identical in-flight requests are coalesced |
| **Parallel service calls** | `asyncio.gather` in the journey/trip detail paths | Multiple leg lookups happen concurrently, not serially |
| **Resilient client with fail-fast breaker** | `shared/http_client.py` | A sick dependency returns quickly instead of holding the request open |
| **Load balancing across replicas** | Kong ring balancer | Throughput scales with replica count on the three hottest services |
| **HTTP/2 + TLS** | Nginx + Certbot | Multiplexed asset delivery |

### Optimisations identified but not yet applied

Ranked by expected impact — these are the concrete next steps, not vague aspirations:

1. **Route-level code splitting (largest win by a wide margin).** Convert the static page imports in `App.tsx` to `React.lazy()` + `<Suspense>`. The operator portal, admin portal and PDF/QR toolchain would leave the initial bundle entirely. Realistically this takes the initial JS from ~1.79 MB to roughly 300–450 KB for a passenger landing on the home page.

   ```tsx
   const AdminPortal    = lazy(() => import("./pages/AdminPortal"));
   const OperatorPortal = lazy(() => import("./pages/OperatorPortal"));
   // …
   <Suspense fallback={<PageSkeleton />}><Routes>…</Routes></Suspense>
   ```

2. **Manual vendor chunking** via `build.rollupOptions.output.manualChunks` — split React/Router, React Query, Leaflet and the jsPDF/html2canvas pair into separate long-cached chunks so an application change does not invalidate the entire vendor payload.
3. **Dynamic-import the PDF and map toolchains.** `jspdf`, `html2canvas` and `leaflet` are together a large share of the bundle and are needed on exactly two screens. Import them inside the handler that uses them.
4. **Lazy-load images** with `loading="lazy"` and `decoding="async"`, and serve WebP/AVIF with explicit `width`/`height` to protect CLS.
5. **Self-host and subset fonts** with `font-display: swap` to remove render-blocking font fetches.
6. **Preconnect / preload** — `<link rel="preconnect">` to the Supabase origin and a `modulepreload` for the entry chunk.
7. **Enable Brotli** in Nginx alongside gzip (typically another 15–20 % on JS).
8. **Virtualise long lists** (search results, bookings, notifications) with `react-window` to cut DOM node count on large result sets.
9. **Skeleton screens** on the search and seat-map routes to improve perceived performance while data loads.
10. **Backend:** enable Kong's `proxy-cache` plugin for the genuinely cacheable public reads (`/api/search/cities`, `/api/operators/routes/`, `/api/deals/flash-sales/active`).

## 8.2 Challenges & Solutions

### Challenge 1 — Preventing double-booked seats under real concurrency

**Problem.** The first implementation read seat availability and then wrote the booking. Under parallel load this is a textbook check-then-act race: two requests both read "available" before either writes. Manual testing with two browser tabs occasionally produced two bookings for one seat — a defect that would make the product unusable in the real world.

**Why it was hard.** A database transaction alone does not solve it cleanly across services: the seat check lives in `inventory-service` while the booking is written in `booking-service`, in a *different database*. Row-level locking cannot span that boundary.

**Solution.** Redis became the arbiter with a genuinely atomic primitive:

```python
# SET key value NX EX 600 — atomic "acquire if absent", with a TTL
return await redis_client.set(f"seat_lock:{trip_id}:{seat_number}",
                              booking_id, nx=True, ex=600)
```

`seat_inventory` remains the durable record; Redis decides who wins. The TTL guarantees an abandoned checkout self-heals even if the application crashes, and stale DB-side locks are reconciled against Redis on the next lock attempt. The seat map overlays live Redis locks on the persisted rows so users see contention in real time.

**Verification.** `run_tests.py concurrency` fires 8 genuinely parallel lock requests via `ThreadPoolExecutor` and asserts exactly one `200` and seven `409`. It has passed on every run since.

**Lesson.** Choose a primitive that is atomic at the level where the contention actually occurs. Application-level "check then write" is not a concurrency strategy.

### Challenge 2 — Booking a multi-leg journey with no distributed transaction

**Problem.** A Dhaka→Sylhet journey via Cumilla means locking seats on two different trips, potentially owned by two different operators, through two independent calls. If leg 2 fails after leg 1 is locked, the naive outcome is a passenger charged for half a journey and a seat held hostage for ten minutes.

**Why it was hard.** There is no `BEGIN … COMMIT` spanning two services. Two-phase commit was rejected as too heavy and too fragile for this system.

**Solution.** An explicit **saga with compensation** in `booking-service/routers/journeys.py`: create the `journeys` row, lock legs in order, and on any failure release everything already locked before returning `409` — with a message that explicitly states no seats were held. Each leg is a normal `bookings` row tagged with `journey_id` and `leg_number`, so all existing per-booking machinery (tickets, cancellation, manifests) keeps working unchanged. Payment is taken once against the journey, and the fraud check validates against the journey total.

**Complication found in production.** Multi-row leg inserts failed only on the deployed stack: Supabase's PgBouncer in transaction-pooling mode breaks `asyncpg`'s prepared-statement cache, which SQLAlchemy's `executemany` relies on. Fixed with `use_insertmanyvalues=False` on the booking engine (BUG-06) — a bug that could only be found by deploying, which is itself the lesson.

**Lesson.** Distributed transactions are replaced by explicitly designed compensation, and the compensation path deserves as much test attention as the happy path.

### Challenge 3 — Trusting the client with money

**Problem.** The first booking implementation accepted `total_fare` from the request body. Editing one number in DevTools bought a BDT 1,720 ticket for BDT 100.

**Solution.** Defence in depth, at two independent services:

- `booking-service` re-fetches the trip from `operator-service` and rejects the request unless the trip exists and is `SCHEDULED`, the operator id matches, the boarding and dropping points are members of the route's declared points, and the fare equals `fare × seats + service fee` within 0.01. Promo discounts are only honoured after `deals-service` independently validates the code.
- `payment-service` re-validates the amount against the booking (or journey), caps attempts at 3 per user per trip, and writes a `fraud.detected` audit event on any mismatch.

**Lesson.** Any value that determines what a user pays must be recomputed server-side from an authoritative source. Client input is a *request*, never a fact.

### Challenge 4 — The whole platform collapsing because of one dependency

**Problem.** Early on, every service opened its Kafka producer at startup and raised if the broker was unreachable. Kafka then failed to restart cleanly due to a Zookeeper `NodeExists` error. Every service crash-looped and every request returned `502` — a total outage caused by a component that is not on the critical path of most requests.

**Solution.** Several layers, applied together:

- **Best-effort connections** where the dependency is not critical: `bank-service` logs and continues without Kafka, because account provisioning self-heals on the first balance fetch.
- **Health and readiness separation** — `/health` (process up) versus `/health/ready` (dependencies reachable), so Kong pulls a *not-ready* instance from rotation instead of the container dying.
- **`restart: unless-stopped`** on every infrastructure service.
- **Circuit breaker** in `ResilientClient` (5 failures → open 30 s → half-open), so a chronically failing dependency fails fast rather than exhausting request workers.
- **Graceful degradation** — `search-service` returns trips with unknown availability rather than failing when `inventory-service` is unreachable.

**Lesson.** In a distributed system, the default behaviour on dependency failure must be a deliberate design decision per dependency. "Crash on startup" is a decision, and usually the wrong one.

### Challenge 5 — Health checks that lied

**Problem.** Kong marked four services `UNHEALTHY` and removed them from rotation despite the services being completely fine. `/health` was returning `401` and `422`.

**Root cause.** FastAPI matches routes in registration order. `booking-service` registered `/{booking_id}` (auth-protected) before the health router, so `/health` matched the greedy path parameter and was rejected as an invalid UUID or unauthenticated.

**Solution.** Register the health router **before** any router with a root-level path parameter, in every affected service, and record it as an explicit codebase convention so the next service does not repeat it.

**Lesson.** Route matching order is part of the API contract. And a health check that can fail for reasons unrelated to health is worse than none, because it triggers automated remediation of a non-problem.

### Challenge 6 — Load balancing that silently was not

**Problem.** After scaling `auth-service` to 3 replicas, Kong kept sending every request to the same container. The scaling had no effect and, without the `instance` field in `/health`, it looked like it was working.

**Root cause.** Kong cached the Docker DNS record from startup and never observed the new A-records.

**Solution.** Point Kong at Docker's embedded DNS resolver (`KONG_DNS_RESOLVER: 127.0.0.11`) with a short stale TTL (`KONG_DNS_STALE_TTL: 4`), document `kong reload` after scaling, and — critically — **make the behaviour observable** by returning the container hostname in every `/health` response so the load test can count distinct responders.

**Lesson.** Infrastructure claims must be *verifiable*. Adding one field to a health response converted an untestable assumption into an automated assertion.

### Challenge 7 — Users being logged out at random

**Problem.** Users were unpredictably thrown back to the login screen mid-session, and a login in one tab left other tabs on a dead token.

**Root causes, two of them.** (a) The Axios interceptor treated *any* refresh failure — including a transient network error or a 5xx — as "session invalid" and logged out. (b) Zustand's in-memory state does not follow `localStorage` writes made by another tab.

**Solution.** The store now clears the session **only** when the refresh is genuinely rejected (400/401/403, or no refresh token exists); network errors and 5xx preserve the session so the user can retry. A `storage` event listener rehydrates every tab when tokens change. In-flight requests during a refresh are queued and replayed with the new token, so exactly one refresh call happens per expiry.

**Lesson.** "The request failed" and "the credential is invalid" are different conditions, and conflating them produces the most infuriating class of user-facing bug.

### Challenge 8 — Google OAuth across three clients

**Problem.** One identity provider had to work in a browser SPA, an Expo Go development client and a native Android build, each with a different redirect mechanism — and existing password-era accounts had to be linked without losing their roles. Android sign-in initially never returned to the app; new Google accounts were created but could not act; Google-authenticated operators could not create routes.

**Solution.** Supabase Auth as the Google broker, exchanged server-side for a BusGo JWT — the token is *verified* against Supabase's `/auth/v1/user`, never trusted. Redirects were enumerated and documented for every client (`https://busgo.farefin.com/login?google=callback`, `http://localhost:5173/login?google=callback`, `busgo://auth/callback`, and `exp://**` for Expo Go with an explicit instruction to remove it before production). Accounts link by verified e-mail and **keep their existing role**. Because Google never guarantees a phone number, phone-less customers are routed through a one-time phone-capture step before checkout so the payment wallet can be provisioned. The whole matrix is written down in `GOOGLE_AUTH_SETUP.md`.

**Lesson.** OAuth complexity lives in redirect configuration and account linking, not in the token exchange. Writing the matrix down early would have saved several days.

### Challenge 9 — Stale bundles served from browser cache

**Problem.** After switching to Google-only login, returning users saw a blank or broken login page. Their browsers were replaying the old password-era JavaScript, which had been served with `immutable` caching.

**Solution.** `no-store` on the SPA shell and `/index.html`, plus an explicit `Clear-Site-Data: "cache"` header on `/login` that instructs the browser to discard the obsolete cache — while deliberately *preserving* storage so valid sessions survive. Content-hashed asset names keep long-lived caching safe for everything else.

**Lesson.** Aggressive caching needs a planned invalidation path *before* it is enabled, not after users are stranded.

### Challenge 10 — Running 20 containers on a 2-vCPU VM

**Problem.** The deployment host had to run 14 services, Kafka, Zookeeper, Elasticsearch, Redis, PostgreSQL, Kong and four observability containers. Builds were OOM-killed; startup thrashed.

**Solution.** A 4 GB swap file provisioned automatically by `setup_server.sh`; the frontend built first to avoid CPU/network contention; staggered container startup; and `restart: unless-stopped` so anything that loses the race recovers by itself.

**Lesson.** Microservices have a fixed per-service overhead that is invisible on a development laptop and very visible on a small VM. Deploy early to discover it.

### Challenge 11 — Four people, one codebase, adjacent files

**Problem.** Four contributors working simultaneously on the frontend pages and shared services produced frequent conflicts, and the low-information commit messages (§7.1) made resolving them harder than necessary.

**Solution.** Per-developer branches plus feature branches for discrete work, with pull requests and explicit merge commits for significant features. Ownership converged naturally: web portals and infrastructure (Tauseef), booking/auth/payment fixes and web-mobile consistency (Tamzid), mobile screens and tests (Farzana), mobile and operator apps (Amina).

**Lesson.** Ownership boundaries should be agreed *before* the code is written, and commit-message discipline should be enforced mechanically rather than by intention.

### Challenge 12 — Windows, Docker and reserved ports

**Problem.** Containers failed to bind on some team members' machines with no obvious cause.

**Root cause.** Windows/Hyper-V reserves the 8081–8180 and 8519–8618 port ranges dynamically.

**Solution.** A documented port scheme outside those ranges, every port overridable via `${VAR:-default}`, and the constraint written into the conventions section of the transit plan so nobody rediscovers it.

**Lesson.** Environment differences within a team are a real cost. Write them down the first time.

## 8.3 Limitations & Future Work

### Security (must be addressed first)

| # | Limitation | Planned work |
|---|---|---|
| L-01 | **Hardcoded credentials in the committed `docker-compose.yml`** (Supabase DB password, `JWT_SECRET=supersecretkey`, Grafana `admin/admin`) — see V-01 | Rotate every value; strip literal defaults so Compose fails loudly on a missing variable; move real values to an untracked `.env` on the server and to GitHub Actions secrets |
| L-02 | Wildcard CORS with credentials on all 14 services | Replace `allow_origins=["*"]` with an explicit environment-driven allow-list |
| L-03 | Internal endpoints (seat lock/release/confirm, reindex, apply-promo, simulate-failure) are publicly reachable and unauthenticated | Remove their public Kong routes, or require a service-to-service token |
| L-04 | `audit-service`'s `verify_admin_role()` is a stub returning `True` | Replace with the standard `require_role(UserRole.ADMIN)` dependency |
| L-05 | No gateway rate limiting | Enable Kong's `rate-limiting` plugin declaratively per route |
| L-06 | `ENVIRONMENT=development` in production, so Swagger and verbose logging are public | Set `production` and gate `/docs` behind authentication on the public host |
| L-07 | Bank PINs stored in plaintext (simulation) | `bcrypt` if ever made real |

### Architecture & data

| # | Limitation | Planned work |
|---|---|---|
| L-08 | **No database migrations** — schemas are created by `create_all()` plus idempotent `ALTER TABLE` statements at startup | Adopt Alembic per service, with migrations reviewed and applied as part of deployment |
| L-09 | **Elasticsearch has no persistent volume**, so the index is lost on a stack recreate and must be rebuilt manually | Attach a named volume; make `reindex` run automatically on `search-service` startup when the index is absent |
| L-10 | The `shared/` library is bind-mounted, so all services are pinned to one version of it | Package it as a versioned wheel installed per service, allowing independent upgrades |
| L-11 | `deals-service` does not use the shared response envelope, and it plus `audit-service` define routes in `main.py` | Refactor both to the standard `routers/` + `BaseResponse` pattern |
| L-12 | A hardcoded `mock_trip_operator = 'OPERATOR_A'` remains in the promo operator-restriction check | Resolve the real operator from the trip |
| L-13 | Seat inventory auto-initialises a default 10×4 layout when a trip has none | Require operators to publish a layout; remove the fallback |
| L-14 | Cross-service references have no referential enforcement | Add a periodic reconciliation job that reports orphans, using the audit log |

### Real-time & performance

| # | Limitation | Planned work |
|---|---|---|
| L-15 | **Notifications are polled every 30 s** rather than pushed | WebSocket or SSE channel in `notification-service`, fanned out from the existing Kafka consumers, with polling retained as a fallback |
| L-16 | **No route-level code splitting** — a 1.79 MB initial JS bundle (§8.1) | `React.lazy()` per route, `manualChunks` vendor splitting, dynamic import of the PDF/map toolchains |
| L-17 | No CDN; all assets are served from the single VM | Put Cloudflare or Azure CDN in front of the static assets |
| L-18 | Seat maps refetch on interval rather than receiving push updates | Publish seat-state changes over the same WebSocket channel as L-15 |
| L-19 | No server-side rendering, so first paint waits on the JS bundle | Consider Next.js or a Vite SSR setup for the public marketing/search routes |

### Testing & delivery

| # | Limitation | Planned work |
|---|---|---|
| L-20 | **No CI/CD pipeline** — deployment is a manually triggered script | Commit the GitHub Actions workflow drafted in §6.1 (typecheck → integration → deploy) |
| L-21 | No unit tests or coverage instrumentation for service internals | `pytest` + `pytest-asyncio` per service with `pytest-cov`, targeting the refund-policy, fare-validation, promo and saga-compensation logic first |
| L-22 | No frontend component tests | Vitest + React Testing Library for `ProtectedRoute`, the refresh-queue interceptor and seat selection |
| L-23 | Interactive OAuth is untested automatically | Playwright with a stored authenticated session state |
| L-24 | No staging environment | A second, smaller VM (or a Compose profile) deployed from `main` before production |
| L-25 | Commit messages are frequently uninformative | commitlint + husky enforcing Conventional Commits; branch protection on `main` |
| L-26 | No load/stress testing beyond a 45-request burst | k6 or Locust scenarios modelling a ticket-release surge |

### Product features

| # | Gap | Planned work |
|---|---|---|
| L-27 | Payment gateways are simulated | Integrate real bKash/Nagad/SSLCommerz sandboxes |
| L-28 | Notification channels (e-mail, SMS, push, WhatsApp) are mocked to files and stdout | Wire SendGrid/SES, an SMS provider, and Firebase Cloud Messaging |
| L-29 | No live bus GPS tracking | A telemetry ingest service with a map view |
| L-30 | No ratings or reviews for operators | Add a review domain feeding operator ranking in search |
| L-31 | No seat-map editor for operators | A visual layout builder writing `buses.seat_layout` |
| L-32 | English only | i18n with Bangla as the second locale |
| L-33 | Accessibility not formally audited | WCAG 2.1 AA pass: focus management, ARIA labels, contrast, keyboard navigation |
| L-34 | Deferred from the transit plan: the per-trip `allow_transit` toggle in `ManageTrips.tsx` and the operator transit manifest view | Both capabilities already exist in the API; only the UI is missing |
| L-35 | No iOS build | EAS iOS build and TestFlight distribution |

## 8.4 Lessons Learned

**1. Microservices buy independence and charge for it in operations.** Fourteen services gave genuinely independent deployment, per-service scaling and clean ownership boundaries — but the cost is not in writing them, it is in everything around them: a gateway to route to them, health checks so the gateway knows what is alive, a message bus so they can talk without coupling, correlation IDs so a single user action is traceable, and a metrics/logging stack so anything is diagnosable at all. Roughly as much effort went into that platform layer as into the business features. For a system this size the trade was worth it *because the concurrency and saga requirements were real*; for a simpler product it would have been a poor trade, and knowing where that line sits is the most transferable thing we learned.

**2. Correctness under concurrency is a design decision, not a code detail.** The seat race could not be fixed by writing more careful application code — it required choosing a primitive (`SET NX EX`) that is atomic at the layer where contention actually occurs. Every subsequent correctness feature followed the same shape: idempotency keys for retries, saga compensation for partial failure, server-side fare recomputation for tampering. Identify the invariant, then pick the mechanism that makes violating it impossible rather than unlikely.

**3. Never trust the client — and defend the same invariant twice.** The fare-tampering bug was a genuine wake-up call. The eventual defence validates the amount in `booking-service` *and* independently in `payment-service`, so a bypass of one layer still fails. Defence in depth is not paranoia; it is the recognition that any single check will eventually be bypassed by a code path nobody anticipated.

**4. Make infrastructure claims observable, or they are just claims.** "Kong load-balances across replicas" was believed for days while every request went to one container. Adding the container hostname to `/health` turned an assumption into an assertion the test suite checks on every run. If a property matters, expose the evidence for it.

**5. Failure modes must be designed per dependency.** The platform-wide outage caused by a Kafka restart taught this at maximum cost. The eventual policy — critical dependencies gate readiness, non-critical ones degrade gracefully, everything restarts, and a breaker prevents a sick dependency from exhausting workers — is now applied deliberately rather than accidentally.

**6. Deploy early; production finds bugs local development cannot.** The PgBouncer/`asyncpg` prepared-statement failure, the OOM-killed builds, the stale-cache login breakage and the Android OAuth redirect were all invisible locally. Every one appeared within hours of a real deployment. Deploying a thin slice in week one, rather than a complete system at the end, would have surfaced them while they were cheap.

**7. Ordering, caching and DNS are where "impossible" bugs live.** Three separate multi-hour investigations — health checks shadowed by a greedy route, browsers replaying an immutable-cached bundle, Kong holding a stale DNS record — all had the same character: the code was correct and something *around* it was stale or mis-ordered. The instinct we developed is to ask "what layer is holding an old answer?" before re-reading the application logic again.

**8. Write down the gotchas the moment you pay for them.** `TRANSIT_TRANSPORTATION_PLAN.md` contains a conventions-and-gotchas section — health-router ordering, the banned Prometheus library, restart-vs-rebuild, Windows-reserved ports, the reindex step — and it measurably reduced the cost of adding the fourteenth service. Documentation written at the moment of pain is worth far more than documentation written at the end.

**9. Enforce process mechanically, because intentions do not scale to four people.** The team knew what good commit messages look like — the best ones in the history prove it — and still produced dozens of `updated` commits, because nothing prevented it. The same applies to secrets: everyone knew credentials do not belong in a public repository, and a convenient default in `docker-compose.yml` outlived the intention to fix it. A `commit-msg` hook and a secret-scanning CI step would have cost an hour each.

**10. A single API serving three clients pays for itself.** The web SPA, the passenger app and the operator app share nothing but the API contract, and that contract held. Features built for the web appeared in the mobile apps with only presentation work. The uniform response envelope and consistent auth model are what made this cheap — the one service that deviates (`deals-service`) is exactly the one that repeatedly needed special-case client code.

**11. Honest documentation is more useful than flattering documentation.** Recording the hardcoded-secrets finding, the missing CI pipeline, the absent code splitting and the stubbed audit role check makes this report a working document rather than a sales pitch. Every one of those items now has a concrete remediation, which would not exist if they had been quietly omitted.

## 8.5 Individual Responsibility

Contribution figures are derived from `git shortlog` across all branches (163 commits on `main`) combined with directory-level authorship analysis. Ownership was collaborative — most features involved several people — so the table records the areas each member drove.

| Member Name | Core Responsibilities & Feature Ownership | Key PRs / Commit Contributions | Estimated % Contribution |
|---|---|---|---|
| **Md. Tauseef - Ur - Rahman** (`TAUSEEF-01`) | **Overall architecture and platform lead.** Microservice decomposition and the 14-service topology; Kong gateway configuration (routes, upstreams, health checks, load balancing); Docker Compose infrastructure; Kafka event backbone; Redis seat-locking design; the `shared/` library (health, observability, resilient HTTP client, Kafka producer, response envelope); Prometheus/Grafana/Loki/Promtail observability stack; the transit (multi-leg) feature design and the journey saga; the web operator and admin portals; production deployment to Azure (`setup_server.sh`, Nginx, Certbot); notification, deals, admin and audit services | 110 commits (incl. merges). `Implement transit (multi-leg / connecting-bus) journeys`; `feat: improve operator transit route management`; `Fix: add restart unless-stopped policies to all infrastructure services`; `chore: stagger container startup in setup_server.sh`; `Fix database URL password encoding`; merge of PR #2. Heaviest footprint in `busgo/frontend/src/pages` (139 file-touches), `busgo/infrastructure` (47), `notification-service` (31), `deals-service` (26), `booking-service` (25) | **~45 %** |
| **Tamzid Tariq** (`Tamzid-Tariq`) | **Booking, payment and cross-client consistency.** Transit journey booking correctness and multi-bus ticketing; session persistence and the token-refresh/logout defect; Google authentication fixes across web and mobile (operator route creation, new-account activation, phone onboarding, Android OAuth callback); payment history and declined-checkout state; wallet synchronisation; booking history grouping by journey and full bus detail display; bank and ticket service fixes | 21 commits. `Fix passenger transit journeys and multi-bus tickets`; `Persist web sessions and restore Google login`; `Fix cached web login and mobile Google redirect`; `Fix payment history and declined checkout state`; `Fix Google operator route creation`; `Fix new Google account activation`; `Fix Android OAuth callback and deployment routing`; `Group user routes by date and bus service`; `Show full bus details in user bookings`; `Complete mobile guest browsing and OAuth callbacks`. Footprint across `frontend/src/pages` (44), `mobile/src/screens` (29), `booking-service/routers` (8), `auth-service/routers` (7) | **~20 %** |
| **Farzana T. N.** (`FarzanaTN`) | **Google authentication implementation and the test suite.** Introduced Google sign-in across web and mobile (Supabase Auth integration, session exchange, redirect handling); mobile passenger screens and auth store; the `busgo/tests` black-box suite (unit/load/concurrency configuration and fixtures); operator-service and booking-service router work; payment-service contributions | 15 commits. `Add Google authentication across web and mobile` (the `feature/google-authentication` branch merged as **PR #2**). Footprint in `mobile/src/screens` (17), `busgo/mobile` (13), `frontend/src/pages` (10), `busgo/tests` (7), `operator-service/routers` (3), `booking-service/routers` (3) | **~18 %** |
| **Amina Islam** (`AminaIslam1912`) | **Mobile applications.** Full redesign of the passenger app and the web-parity feature set (guest browsing, transit journeys, seat holds, promo codes, tickets, notifications, profile/wallet); the separate Expo **operator app** (dashboard, buses, routes, trips, transit routes, bookings, deals, fill-seats, notify, analytics); shared mobile UI components and stores; deals-service contributions | 14 commits. `Redesign mobile app and add web-parity features`. Footprint in `mobile/src/screens` (38), `operator/src/screens` (12), `busgo/mobile` (14), `busgo/operator` (8), `mobile/src/components` (7), `mobile/src/store` (4), `frontend/src/pages` (6) | **~17 %** |

> **Note for submission:** percentages are estimates derived from commit counts and directory-level file-touch analysis, and are deliberately weighted by scope of ownership rather than raw commit count alone. Adjust them if the team's own assessment of effort differs — and fill in the student IDs on the cover page.

---

# Appendix — Screenshots / UI Walkthrough

> **Action required before submission:** capture the screenshots listed below and insert them at the marked positions. Save them under `report/screenshots/` and reference them as `![Caption](screenshots/NN-name.png)`. The walkthrough narrative is written so the images slot straight in.

## A. Passenger journey (web)

| # | Screen | What it should show | File |
|---|---|---|---|
| A1 | **Home / search** | Hero with origin/destination city comboboxes, date picker, and the popular-routes section | `screenshots/01-home.png` |
| A2 | **Search results** | Trip cards with operator, bus type, departure/arrival, fare, live available-seat count, amenities and filters | `screenshots/02-search-results.png` |
| A3 | **Transit itineraries** | Multi-leg cards with the operator-curated badge ranked above auto-discovered ones, transfer city and wait time, combined discount | `screenshots/03-transit-results.png` |
| A4 | **Seat map** | Live seat grid with available / locked / booked states, seat types, the running fare, and the selection limit of 4 | `screenshots/04-seat-map.png` |
| A5 | **Passenger details** | One form per selected seat, with Zod validation feedback | `screenshots/05-passenger-details.png` |
| A6 | **Payment** | bKash / Nagad / bank options, the **10-minute hold countdown**, promo-code field, and the fare breakdown | `screenshots/06-payment.png` |
| A7 | **Promo applied** | The discount reflected in the amount due (proving the discount is persisted server-side) | `screenshots/07-promo-applied.png` |
| A8 | **Confirmation** | Booking reference, QR code, and the PDF-download action | `screenshots/08-confirmation.png` |
| A9 | **E-ticket (PDF)** | The rendered ticket with passenger, seat, route, time and QR | `screenshots/09-eticket.png` |
| A10 | **My bookings** | History with transit legs **grouped under one journey**, showing transfer points | `screenshots/10-my-bookings.png` |
| A11 | **Cancellation** | Refund eligibility and computed amount shown *before* the user commits | `screenshots/11-cancellation.png` |
| A12 | **Notifications** | Inbox with unread badge, typed notification cards, read/read-all/delete controls | `screenshots/12-notifications.png` |
| A13 | **Profile & wallet** | Editable profile, account balances, travel and payment summary | `screenshots/13-profile.png` |
| A14 | **Google sign-in** | The Google-only login screen and the consent redirect | `screenshots/14-login.png` |

## B. Operator portal (web)

| # | Screen | What it should show | File |
|---|---|---|---|
| B1 | **Operator dashboard** | Trips, occupancy and revenue at a glance | `screenshots/15-operator-dashboard.png` |
| B2 | **Manage buses** | Fleet CRUD with registration, type, seat layout and amenities | `screenshots/16-operator-buses.png` |
| B3 | **Manage routes** | Route CRUD with boarding/dropping points selected on the Leaflet map | `screenshots/17-operator-routes.png` |
| B4 | **Manage trips** | Trip scheduling, fare and status controls | `screenshots/18-operator-trips.png` |
| B5 | **Transit routes** | Curated connecting-route builder with via-cities and combined discount | `screenshots/19-operator-transit.png` |
| B6 | **Bookings / manifest** | Passenger manifest per trip, with connecting passengers flagged | `screenshots/20-operator-bookings.png` |
| B7 | **Deals** | Operator-scoped promo codes and flash sales | `screenshots/21-operator-deals.png` |
| B8 | **Fill empty seats** | Matched past passengers on the corridor and the targeted-offer action | `screenshots/22-fill-empty-seats.png` |
| B9 | **Analytics** | Revenue and occupancy charts | `screenshots/23-operator-analytics.png` |

## C. Admin portal (web)

| # | Screen | What it should show | File |
|---|---|---|---|
| C1 | **Admin dashboard** | Platform-wide user, operator, trip and revenue statistics | `screenshots/24-admin-dashboard.png` |
| C2 | **User management** | User list with role promotion/demotion | `screenshots/25-admin-users.png` |
| C3 | **Transactions** | Transaction list and revenue summary | `screenshots/26-admin-transactions.png` |
| C4 | **Notices & broadcast** | Notice publishing and platform-wide notification broadcast | `screenshots/27-admin-notices.png` |
| C5 | **Audit log** | Event trail filtered by type/entity/user | `screenshots/28-admin-audit.png` |

## D. Mobile applications

| # | Screen | What it should show | File |
|---|---|---|---|
| D1 | **Passenger — home & search** | City selection and date picker on device | `screenshots/29-mobile-home.png` |
| D2 | **Passenger — results & transit** | Direct and connecting journeys | `screenshots/30-mobile-results.png` |
| D3 | **Passenger — seat map** | Native seat grid with the hold countdown | `screenshots/31-mobile-seats.png` |
| D4 | **Passenger — payment & ticket** | Payment sheet and the QR e-ticket | `screenshots/32-mobile-ticket.png` |
| D5 | **Passenger — bookings & alerts** | Journey-grouped history and the notification inbox | `screenshots/33-mobile-bookings.png` |
| D6 | **Operator app — dashboard** | Operator home on device | `screenshots/34-operator-app-dashboard.png` |
| D7 | **Operator app — trips & fill seats** | Trip management and the fill-empty-seats campaign | `screenshots/35-operator-app-trips.png` |

## E. Platform & operations evidence

| # | View | What it should show | File |
|---|---|---|---|
| E1 | **Grafana — BusGo overview** | Request rate, error rate and latency per service; per-instance traffic proving load balancing | `screenshots/36-grafana.png` |
| E2 | **Prometheus targets** | All 14 services plus Kong scraping successfully | `screenshots/37-prometheus.png` |
| E3 | **Loki log query** | A single `request_id` traced across gateway → booking → inventory → payment | `screenshots/38-loki-correlation.png` |
| E4 | **Kong upstream health** | `run_tests.py status` output showing every target `HEALTHY` | `screenshots/39-kong-status.png` |
| E5 | **Seat-concurrency test** | Terminal output: `Exactly 1 winner and 7 correctly rejected — no double-booking` | `screenshots/40-concurrency-test.png` |
| E6 | **Load-balancing test** | Terminal output showing 3 distinct instances answering a 45-request burst | `screenshots/41-load-test.png` |
| E7 | **Unit/readiness suite** | All 14 services passing liveness and readiness | `screenshots/42-unit-tests.png` |
| E8 | **Swagger UI** | A service's interactive API documentation served through Kong | `screenshots/43-swagger.png` |
| E9 | **Lighthouse report** | The mobile Performance run backing §8.1 | `screenshots/44-lighthouse.png` |
| E10 | **`docker compose ps`** | The full running topology on the production VM | `screenshots/45-docker-ps.png` |

### Suggested demo-video running order (5–7 minutes)

1. Landing page → search Dhaka → Cumilla → results with live seat counts.
2. Search Dhaka → Sylhet → **transit itineraries**, highlighting an operator-curated option.
3. Seat map → open the same trip in a second browser and lock a seat → show it grey out in the first without a refresh (**data sync**, §2.4.4).
4. Passenger details → promo code → payment with the countdown → confirmation → QR e-ticket.
5. Notification bell increments within 30 seconds (**polling**).
6. Operator portal: create a trip → show it appear in passenger search (**Kafka → Elasticsearch propagation**).
7. Operator: **Fill Empty Seats** → send an offer → show it arrive in the passenger's inbox.
8. Admin portal: dashboard, role change, audit log entry for the booking just made.
9. Terminal: `python run_tests.py concurrency` — 8 users, exactly one winner.
10. Grafana dashboard and a Loki correlation-ID trace of the booking from step 4.

---

*End of report.*
