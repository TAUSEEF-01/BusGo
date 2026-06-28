# BusGo test suite

Lightweight, dependency-free tests that drive the running stack through the Kong
gateway. Three things are covered:

1. **Unit tests** — liveness, readiness (DB+Redis) and smoke endpoints for all 13 services.
2. **Load-balancing tests** — fire a burst of requests and show how they spread across replicas.
3. **Seat-concurrency test** — many users race for the *same* seat; exactly one must win.

## Requirements
- The stack must be running: `docker compose -f ../infrastructure/docker-compose.yml up -d`
- Python 3.8+ (standard library only — no `pip install` needed)

## Run

```bash
cd busgo/tests

python run_tests.py            # run everything (unit + load + concurrency + status)
python run_tests.py unit       # health/readiness/smoke for all 13 services
python run_tests.py load       # load-balancing distribution across replicas
python run_tests.py concurrency# multiple users booking the SAME seat
python run_tests.py status     # view current load & replica health
```

Point it at a different host/ports without editing anything:
```bash
KONG_URL=http://localhost:18085 KONG_ADMIN_URL=http://localhost:18089 python run_tests.py all
```

Exit code is non-zero if any test fails (handy for CI).

## Files
| File | Purpose |
|------|---------|
| `run_tests.py` | the runner (unit / load / concurrency / status) |
| `config.json` | gateway URLs, the 13 services, smoke endpoints, load & concurrency knobs |
| `test_data.json` | sample request payloads (also used by the curl reference) |
| `curl_commands.md` | copy-paste curl unit tests for every service |

## What "load balancing" looks like here
`auth-service`, `search-service` and `booking-service` run **3 replicas** each.
Every `/health` response includes an `instance` field (the container id), so the
load test counts how many distinct instances answered a burst — proving Kong's
ring balancer is round-robining across replicas.

If only one instance answers right after you scale or restart, Kong is holding a
stale DNS record. Refresh it:
```bash
docker exec infrastructure-kong-1 kong reload
```

## Tuning
Edit `config.json`:
- `load_balancing.requests` / `concurrency` — size of the load burst.
- `seat_concurrency.users` — how many users fight for one seat.
