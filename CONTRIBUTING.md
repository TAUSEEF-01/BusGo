# Contributing to BusGo

Thanks for taking the time to contribute. This document describes how the repository is organised, how to get a change from a local edit to `main`, and the conventions and gotchas that are not obvious from reading the code.

Start with the [README](README.md) for setup; this file covers the workflow.

---

## Table of Contents

- [Getting Set Up](#getting-set-up)
- [Branching Strategy](#branching-strategy)
- [Commit Conventions](#commit-conventions)
- [Pull Requests](#pull-requests)
- [Before You Push — Required Checks](#before-you-push--required-checks)
- [Codebase Conventions](#codebase-conventions)
- [Gotchas](#gotchas)
- [Adding a New Service](#adding-a-new-service)
- [Reporting Bugs](#reporting-bugs)
- [Security Issues](#security-issues)

---

## Getting Set Up

Follow [Local Setup](README.md#local-setup) in the README. In short:

```bash
git clone https://github.com/TAUSEEF-01/Jaabo.git && cd Jaabo
for f in busgo/services/*/.env.example; do cp "$f" "$(dirname "$f")/.env"; done
# create busgo/infrastructure/.env — see README § Environment Variables
make up
make seed
curl -X POST http://localhost:18085/api/search/reindex
cd busgo/tests && python run_tests.py unit
```

If `run_tests.py unit` is green, your environment is correct and you can start work.

Never commit a `.env` file. Only `.env.example` files are tracked, and they must contain placeholders — never real credentials.

---

## Branching Strategy

A **feature-branch workflow** with `main` as the single always-deployable trunk. `setup_server.sh` runs `git reset --hard origin/main` on the production VM, so **whatever is on `main` is production**.

```
main                              ← protected trunk; production deploys from here
├── feature/<name>                ← a discrete feature, merged via pull request
└── <developer-name>              ← personal integration branch for parallel work
```

| Branch | Purpose |
|---|---|
| `main` | Always deployable. Never push directly for anything non-trivial. |
| `feature/<name>` | One feature or fix, developed in isolation, merged through a PR. Example: `feature/google-authentication`. |
| `<developer-name>` | A personal integration branch (`tauseef`, `tamzid`, `tbt`) for when several people are touching adjacent files. Rebase or merge from `main` often. |

Branch from an up-to-date `main`:

```bash
git checkout main && git pull
git checkout -b feature/operator-manifest-export
```

Integration merges are kept as explicit merge commits so the branch topology shows how parallel work converged, rather than being flattened.

---

## Commit Conventions

Use **Conventional Commits** — `type(scope): summary` — in the imperative mood, one logical change per commit:

```
feat(operator): add transit route builder with via-city selection
fix(booking): release leg 1 when leg 2 lock fails
fix: asyncpg prepared statement caching issue with PgBouncer
chore: stagger container startup in setup_server.sh
docs(mobile): document the Expo Go SDK 57 requirement
```

| Type | Use for |
|---|---|
| `feat` | A new user-facing capability |
| `fix` | A bug fix |
| `refactor` | A change that alters structure but not behaviour |
| `perf` | A performance improvement |
| `test` | Tests only |
| `docs` | Documentation only |
| `chore` | Build, tooling, infrastructure, dependencies |

Common scopes: `auth`, `search`, `transit`, `inventory`, `booking`, `payment`, `bank`, `ticket`, `cancellation`, `operator`, `deals`, `notification`, `admin`, `audit`, `web`, `mobile`, `infra`, `kong`.

**Say what changed and why.** A message like `update`, `updated` or `fix stuff` carries no information; bisecting a regression through a run of such commits is materially harder than it needs to be. If the body of the commit needs two sentences to explain the root cause, write them — a future maintainer (probably you) will need them.

---

## Pull Requests

1. Keep the PR focused on one change. A PR that fixes a bug *and* renames forty files is unreviewable.
2. Fill in the description with **what changed, why, and how it was verified**. If it touches the booking, payment or seat-locking path, say explicitly which tests you ran.
3. Include a screenshot or short clip for any UI change (web, mobile or operator app).
4. Rebase or merge `main` in before requesting review, and make sure the branch still builds.
5. Get **one approving review** before merging. Do not merge your own PR for changes to the booking, payment, inventory or auth services.
6. Do not merge a PR whose checks (see below) have not been run.

---

## Before You Push — Required Checks

There is no CI pipeline yet, so these gates are your responsibility.

**Backend / any service change**

```bash
cd busgo/tests
python run_tests.py unit          # liveness + readiness + smoke for all 14 services
python run_tests.py concurrency   # the seat-locking invariant — run this for ANY
                                  # change to inventory, booking or payment
python run_tests.py transit       # run for any change to transit or the journey saga
python run_tests.py               # full suite before opening a PR
```

`run_tests.py` is dependency-free (standard library only) and exits non-zero on failure. All knobs live in `busgo/tests/config.json` — extending coverage should be a data change, not a code change.

**Web frontend**

```bash
cd busgo/frontend
npm run lint
npm run build      # runs `tsc -b`; a type error here fails the Docker image build
```

**Mobile / operator apps**

```bash
cd busgo/mobile    # or busgo/operator
npm run verify     # typecheck + expo-doctor
```

**Manual verification.** The automated suite is black-box integration, not unit tests — it will not catch a broken checkout screen. For any change to a user-facing flow, sign in as the relevant seeded role (see [Test Credentials](README.md#test-credentials)) and walk the flow end to end.

---

## Codebase Conventions

### Service layout

Every service follows the same internal structure, so moving between services costs nothing:

```
services/<name>/
├── main.py             # FastAPI app, CORS, observability, health router, startup hooks
├── core/config.py      # pydantic-settings, env-driven — no literals in code
├── api/deps.py         # get_current_user_payload(), require_role()
├── routers/            # HTTP layer: thin — validate → delegate → envelope
├── services/           # domain + integration layer (external.py, redis_svc.py, …)
├── models/             # SQLAlchemy declarative models
├── schemas/            # Pydantic request/response models
├── Dockerfile
├── requirements.txt
└── .env.example
```

Keep routers thin. Business logic, external HTTP calls and Kafka publishing belong in `services/`, not in the route handler.

### Shared code

`busgo/shared/` is bind-mounted into every container at `/app/shared`. If something is genuinely common — health checks, metrics, the response envelope, the resilient HTTP client, enums, Kafka helpers — it goes there and **is not copied into a service**. Changing a shared module affects all 14 services, so test broadly and restart every container after editing it.

- **Response envelope.** Return `{success, data, message, errors}` via `shared/base_response.py`. (`deals-service` predates this and returns raw objects — do not copy that pattern; fixing it is a welcome PR.)
- **Enums.** `BookingStatus`, `UserRole`, `PaymentMethod` and friends live in `shared/enums.py`. Never redefine one locally — that drift was BUG-26 and needed SQL repair scripts.
- **Observability.** Call `setup_observability(app, SERVICE_NAME)` in `main.py`. It installs `/metrics`, JSON logging and `X-Request-ID` correlation.
- **Inter-service calls.** Always go through `shared/http_client.py` (`ResilientClient`) — never call `httpx` directly from a router. The client applies split timeouts, backoff retries, the per-host circuit breaker and the correlation header uniformly.

### Never trust the client

- Validate every request body with a Pydantic schema. Frontend validation (React Hook Form + Zod) is UX only.
- Re-derive anything that touches money server-side. `booking-service` re-fetches the trip from `operator-service` and rejects mismatched fare, operator, trip status or boarding/dropping point (BUG-03).
- Scope every query to the caller — `where(Booking.id == booking_id, Booking.user_id == user_id)` — so substituting another user's UUID returns `404`, not data.
- Enforce roles with `require_role(UserRole.OPERATOR)` on the endpoint. `ProtectedRoute` in the SPA is a UX gate and is assumed bypassable.

### Database

- Each service owns its own logical database. **Never query another service's tables** — cross-service references are by UUID only, and the relationship is fetched over HTTP or arrives via an event.
- Access the database through SQLAlchemy's ORM/expression language with bound parameters. There is no string-concatenated SQL in service code, and there should not be.
- Use `JSONB` only where the shape is genuinely document-like (seat layouts, passenger details, amenities, event payloads).

### Events

- Publish through `shared/kafka_producer.py`. Adding a consumer must never require a change to the producer.
- Kafka is for work that can be eventual (tickets, notifications, audit). Anything that must be deterministically ordered — money, seat locks — stays on the synchronous orchestrated path in `booking-service`.
- If a service can usefully start without Kafka, make the connection best-effort and log rather than raising at startup (BUG-04).

### Frontend

- Server-derived state belongs to **React Query**; genuinely global client state (session, notifications) belongs to **Zustand**. Do not put fetched data in a Zustand store.
- A feature with real weight gets a vertical slice — `src/notifications/` holds its own API client, store and components together.
- No `dangerouslySetInnerHTML`.

---

## Gotchas

These have each cost someone a day. They are listed in the bug log (§5.3 of the project report) and are repeated here because they are not discoverable from the code.

| Gotcha | What happens | What to do |
|---|---|---|
| **Register the health router first** | A greedy `/{id}` route registered earlier swallows `/health`, which returns `401`/`422`, and Kong marks the whole service `UNHEALTHY` and drops it from rotation | In `main.py`, `include_router(create_health_router(...))` **before** any router with a root path parameter |
| **`prometheus-fastapi-instrumentator` is banned** | It resolves route names by iterating `app.routes`, which crashes on this FastAPI version's lazy `_IncludedRouter` objects — every request 500s | Use the middleware already in `shared/observability.py` |
| **Source is bind-mounted** | A code edit appears to do nothing because Python has not re-imported | `docker restart <container>`. Use `--build` **only** when `requirements.txt` changed |
| **Kong caches DNS** | After `--scale`, Kong keeps routing to one replica | `docker exec infrastructure-kong-1 kong reload` |
| **Elasticsearch has no volume** | Bus search returns `500` after any full stack recreate | `curl -X POST http://localhost:18085/api/search/reindex` |
| **PgBouncer transaction mode** | Multi-row inserts work locally but fail against Supabase — `asyncpg`'s prepared-statement caching is incompatible | `use_insertmanyvalues=False` and statement caching disabled on the pooled engine (already done for the booking engine; replicate it if you add one) |
| **Windows reserved ports** | Containers fail to bind for no visible reason | Stay outside 8081–8180 and 8519–8618; every host port is `${VAR:-default}`-overridable |
| **Percent-encode DB passwords** | A password containing `'` or `@` breaks `DATABASE_URL` parsing | URL-encode the credential |
| **Mobile cannot reach `localhost`** | The Expo app times out against the API | Set `EXPO_PUBLIC_API_URL` to the workstation's LAN IP and open the port in the firewall |

---

## Adding a New Service

1. Copy the layout of an existing small service (`audit-service` or `bank-service` are good templates).
2. Add `main.py` with `setup_observability(app, SERVICE_NAME)` and the health router **registered first**.
3. Add a `.env.example` with placeholders for every variable the service reads.
4. Add the service to `busgo/infrastructure/docker-compose.yml`, with a `${<NAME>_SERVICE_PORT:-<default>}` host port outside the Windows-reserved ranges — or no host port at all if it should be scalable behind Kong.
5. Declare the route, upstream and health check in `busgo/infrastructure/kong/kong.yml`. Remember `strip_path: true`, so `/api/foo/bar` reaches the service as `/bar`.
6. Add the service to `busgo/infrastructure/prometheus/prometheus.yml` so it is scraped.
7. If it needs its own database, add it to `busgo/infrastructure/postgres/init-multiple-databases.sh`.
8. Add it to `busgo/tests/config.json` — its prefix, expected replica count and a smoke endpoint — then confirm `run_tests.py unit` covers it.
9. Update the service table in the [README](README.md#services--routes).

---

## Reporting Bugs

Open a GitHub issue with:

- **What you did** — the exact request, or the click path and role you were signed in as.
- **What you expected** and **what happened**, including the HTTP status and response body.
- **The `X-Request-ID`** from the response headers if you have it. That single value retrieves the full cross-service trace:

  ```logql
  {job="containerlogs"} | json | request_id="<the id>"
  ```

- The relevant container logs: `docker compose logs --tail=200 <service>`.
- Whether it reproduces locally, on the deployed host, or both.

---

## Security Issues

Please **do not** open a public issue for a security vulnerability. Contact a maintainer directly.

Known open items are documented in §4.4 and §8.3 of the [project report](output/pdf/BusGo_Final_Project_Report.pdf) — hardcoded demo secrets, wildcard CORS with credentials, unauthenticated internal endpoints, the `audit-service` role stub, and the absence of gateway rate limiting. Contributions that close any of these are especially welcome; check the report first so the fix matches the intended design.
