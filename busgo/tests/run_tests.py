#!/usr/bin/env python3
"""BusGo test runner — unit, load-balancing, and seat-concurrency tests.

Pure standard library (no pip install needed). Talks to the stack through the
Kong gateway, so it exercises the same path real clients use.

Usage:
    python run_tests.py unit          # health + readiness + smoke checks (all 13 services)
    python run_tests.py load          # load-balancing distribution across replicas
    python run_tests.py concurrency   # multiple users racing for the SAME seat
    python run_tests.py status        # view current load / replica health
    python run_tests.py all           # everything (default)

Override endpoints without editing config.json:
    KONG_URL=http://host:18085 KONG_ADMIN_URL=http://host:18089 python run_tests.py all
"""
import argparse
import json
import os
import sys
import time
import uuid
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))


def load_json(name):
    with open(os.path.join(HERE, name), "r", encoding="utf-8") as f:
        return json.load(f)


CONFIG = load_json("config.json")
BASE = os.environ.get("KONG_URL", CONFIG["kong_proxy_url"]).rstrip("/")
ADMIN = os.environ.get("KONG_ADMIN_URL", CONFIG["kong_admin_url"]).rstrip("/")
PROM = os.environ.get("PROMETHEUS_URL", CONFIG.get("prometheus_url", "")).rstrip("/")

# ---- tiny ANSI helpers (degrade gracefully on dumb terminals) ----
_USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _c(code, s):
    return f"\033[{code}m{s}\033[0m" if _USE_COLOR else s


def green(s): return _c("32", s)
def red(s): return _c("31", s)
def yellow(s): return _c("33", s)
def cyan(s): return _c("36", s)
def bold(s): return _c("1", s)


PASS = green("[PASS]")
FAIL = red("[FAIL]")
WARN = yellow("[WARN]")
INFO = cyan("[INFO]")


def header(title):
    print("\n" + bold("=" * 70))
    print(bold(f"  {title}"))
    print(bold("=" * 70))


# ---- HTTP ----
def http(method, url, body=None, headers=None, timeout=15):
    """Returns (status_code|None, text, elapsed_seconds)."""
    data = None
    h = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        h["Content-Type"] = "application/json"
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", "replace")
            return resp.status, text, time.perf_counter() - start
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), time.perf_counter() - start
    except Exception as e:  # connection refused, timeout, DNS, etc.
        return None, f"{type(e).__name__}: {e}", time.perf_counter() - start


def jload(text):
    try:
        return json.loads(text)
    except Exception:
        return None


# ============================================================
# 1. UNIT TESTS — health, readiness, smoke endpoints
# ============================================================
def cmd_unit(_args):
    header("UNIT TESTS — liveness, readiness & smoke endpoints (via Kong)")
    passed = failed = 0

    print(bold("\nLiveness  (GET <prefix>/health  -> 200)"))
    for svc in CONFIG["services"]:
        url = f"{BASE}{svc['prefix']}/health"
        status, text, dt = http("GET", url)
        body = jload(text) or {}
        ok = status == 200 and body.get("status") == "ok"
        print(f"  {PASS if ok else FAIL} {svc['name']:<22} {status}  ({dt*1000:.0f} ms)  {url}")
        passed += ok
        failed += not ok

    print(bold("\nReadiness (GET <prefix>/health/ready -> 200, DB+Redis ok)"))
    for svc in CONFIG["services"]:
        url = f"{BASE}{svc['prefix']}/health/ready"
        status, text, dt = http("GET", url)
        body = jload(text) or {}
        ok = status == 200 and body.get("status") == "ready"
        checks = body.get("checks", {})
        detail = " ".join(f"{k}={v}" for k, v in checks.items())
        print(f"  {PASS if ok else FAIL} {svc['name']:<22} {status}  {detail}")
        passed += ok
        failed += not ok

    print(bold("\nSmoke endpoints (unauthenticated GETs)"))
    for ep in CONFIG.get("smoke_endpoints", []):
        url = f"{BASE}{ep['path']}"
        status, text, dt = http(ep["method"], url)
        ok = status == ep["expect"]
        print(f"  {PASS if ok else FAIL} {ep['service']:<22} {status}  {ep['method']} {ep['path']}  ({ep['desc']})")
        passed += ok
        failed += not ok

    print(f"\n{bold('Unit summary:')} {green(str(passed)+' passed')}, "
          f"{red(str(failed)+' failed') if failed else '0 failed'}")
    return failed == 0


# ============================================================
# 2. LOAD-BALANCING TEST — distribution across replicas
# ============================================================
def _hit_health(url):
    status, text, dt = http("GET", url, timeout=10)
    body = jload(text) or {}
    return status, body.get("instance", "?"), dt


def cmd_load(_args):
    header("LOAD-BALANCING TEST — request distribution across replicas")
    lb = CONFIG["load_balancing"]
    n = lb["requests"]
    conc = lb["concurrency"]
    overall_ok = True

    for svc_name in lb["targets"]:
        svc = next(s for s in CONFIG["services"] if s["name"] == svc_name)
        url = f"{BASE}{svc['prefix']}/health"
        print(bold(f"\n{svc_name}  ({svc['replicas']} replica(s) expected)"))
        print(f"  Firing {n} requests @ concurrency {conc} -> {url}")

        instances = Counter()
        statuses = Counter()
        latencies = []
        with ThreadPoolExecutor(max_workers=conc) as ex:
            for status, inst, dt in ex.map(lambda _: _hit_health(url), range(n)):
                statuses[status] += 1
                latencies.append(dt)
                if status == 200:
                    instances[inst] += 1

        ok_count = statuses.get(200, 0)
        rate_limited = statuses.get(429, 0)
        print(f"  Status codes: {dict(statuses)}")
        if rate_limited:
            print(f"  {INFO} {rate_limited} request(s) rate-limited (HTTP 429) — Kong rate-limiter active")
        if latencies:
            latencies.sort()
            p95 = latencies[int(len(latencies) * 0.95) - 1]
            print(f"  Latency: min {min(latencies)*1000:.0f} / avg "
                  f"{sum(latencies)/len(latencies)*1000:.0f} / p95 {p95*1000:.0f} / max {max(latencies)*1000:.0f} ms")

        total_ok = sum(instances.values())
        print(f"  {bold('Distribution across instances')} (of {total_ok} successful responses):")
        for inst, count in instances.most_common():
            bar = "#" * max(1, round(count / max(1, total_ok) * 40))
            pct = count / max(1, total_ok) * 100
            print(f"    {inst[:18]:<18} {count:>4} ({pct:4.1f}%)  {bar}")

        distinct = len(instances)
        if svc["replicas"] > 1:
            if distinct >= 2:
                print(f"  {PASS} balanced across {distinct} instances")
            elif total_ok == 0:
                print(f"  {WARN} no successful responses to judge balancing "
                      f"(all rate-limited?) — re-run after the rate-limit window resets (~1 min)")
                overall_ok = False
            else:
                print(f"  {WARN} only {distinct} instance answered — "
                      f"if you just scaled/restarted, run: docker exec infrastructure-kong-1 kong reload")
                overall_ok = False
        else:
            print(f"  {INFO} single-instance service (1 instance expected)")
        # A run is OK if nothing errored outright (200 + 429 are both "served").
        served = ok_count + rate_limited
        overall_ok = overall_ok and served == n

    return overall_ok


# ============================================================
# 3. SEAT-CONCURRENCY TEST — many users race for the SAME seat
# ============================================================
def _discover_trip_and_seat():
    """Find a real trip with at least one AVAILABLE seat. Returns (trip_id, seat_number) or (None, None)."""
    status, text, _ = http("GET", f"{BASE}/api/operators/trips/")
    trips = (jload(text) or {}).get("data") or []
    if not trips:
        return None, None
    for trip in trips[:10]:
        trip_id = trip.get("id")
        if not trip_id:
            continue
        st, tx, _ = http("GET", f"{BASE}/api/inventory/trips/{trip_id}/seats")
        seats = (jload(tx) or {}).get("data") or []
        for seat in seats:
            if seat.get("status") == "AVAILABLE":
                return trip_id, seat["seat_number"]
    return None, None


def cmd_concurrency(_args):
    header("SEAT-CONCURRENCY TEST — multiple users booking the SAME seat")
    users = CONFIG["seat_concurrency"]["users"]

    trip_id, seat = _discover_trip_and_seat()
    if not trip_id:
        print(f"  {WARN} No trip with an available seat found — is the stack seeded? Skipping.")
        return True
    print(f"  Trip:  {trip_id}")
    print(f"  Seat:  {seat}")
    print(f"  {users} users will try to lock seat {seat} at the SAME time...\n")

    lock_url = f"{BASE}/api/inventory/trips/{trip_id}/seats/lock"
    bookings = [str(uuid.uuid4()) for _ in range(users)]

    def attempt(booking_id):
        body = {"seat_numbers": [seat], "booking_id": booking_id, "user_id": str(uuid.uuid4())}
        status, text, dt = http("POST", lock_url, body=body)
        return booking_id, status, text, dt

    results = []
    with ThreadPoolExecutor(max_workers=users) as ex:
        results = list(ex.map(attempt, bookings))

    winners = [r for r in results if r[1] == 200]
    rejected = [r for r in results if r[1] == 409]
    other = [r for r in results if r[1] not in (200, 409)]

    for booking_id, status, text, dt in results:
        if status == 200:
            tag, label = PASS, "WON the seat (200)"
        elif status == 409:
            tag, label = INFO, "rejected, seat taken (409)"
        else:
            tag, label = FAIL, f"unexpected ({status})"
        print(f"  {tag} user {booking_id[:8]}  {label}  ({dt*1000:.0f} ms)")

    print()
    ok = len(winners) == 1 and len(other) == 0
    if ok:
        print(f"  {PASS} Exactly 1 winner and {len(rejected)} correctly rejected — "
              f"{green('no double-booking')}.")
    else:
        print(f"  {FAIL} Expected exactly 1 winner, got {len(winners)} winners, "
              f"{len(rejected)} rejected, {len(other)} errored.")

    # cleanup: release the seat the winner grabbed
    if winners:
        win_booking = winners[0][0]
        http("POST", f"{BASE}/api/inventory/trips/{trip_id}/seats/release",
             body={"seat_numbers": [seat], "booking_id": win_booking})
        print(f"  {INFO} cleaned up — released seat {seat} (booking {win_booking[:8]})")

    return ok


# ============================================================
# 4. STATUS — view current load / replica health
# ============================================================
def cmd_status(_args):
    header("CURRENT LOAD & REPLICA HEALTH")

    print(bold("\nKong upstream target health (admin API)"))
    print("  (one DNS target per upstream resolves to all replica IPs — see the live snapshot below)")
    any_admin = False
    for svc in CONFIG["services"]:
        if svc["replicas"] <= 1:
            continue
        url = f"{ADMIN}/upstreams/{svc['upstream']}/health"
        status, text, _ = http("GET", url, timeout=8)
        if status != 200:
            print(f"  {WARN} {svc['upstream']:<20} admin API unreachable ({status}) at {url}")
            continue
        any_admin = True
        data = (jload(text) or {}).get("data") or []
        healthy = sum(1 for t in data if t.get("health") == "HEALTHY")
        print(f"  {svc['upstream']:<20} {healthy}/{len(data)} HEALTHY")
        for t in data:
            h = t.get("health", "?")
            mark = green(h) if h == "HEALTHY" else red(h)
            print(f"      {t.get('target','?'):<22} {mark}")
    if not any_admin:
        print(f"  {WARN} Kong admin API not reachable at {ADMIN} (is the port published?)")

    # Live distribution snapshot for replicated services
    print(bold("\nLive instance snapshot (20 quick probes each)"))
    for svc in CONFIG["services"]:
        if svc["replicas"] <= 1:
            continue
        url = f"{BASE}{svc['prefix']}/health"
        instances = Counter()
        with ThreadPoolExecutor(max_workers=10) as ex:
            for status, inst, _ in ex.map(lambda _: _hit_health(url), range(20)):
                if status == 200:
                    instances[inst] += 1
        spread = ", ".join(f"{i[:12]}={c}" for i, c in instances.most_common())
        print(f"  {svc['name']:<20} {len(instances)} instance(s): {spread}")

    # Prometheus up-target count (best effort)
    if PROM:
        print(bold("\nPrometheus targets"))
        status, text, _ = http("GET", f"{PROM}/api/v1/query?query=up", timeout=8)
        data = jload(text)
        if status == 200 and data and data.get("status") == "success":
            res = data["data"]["result"]
            up = sum(1 for r in res if r["value"][1] == "1")
            print(f"  {INFO} {up}/{len(res)} scrape targets UP")
        else:
            print(f"  {WARN} Prometheus not reachable at {PROM}")
    return True


# ============================================================
def main():
    parser = argparse.ArgumentParser(description="BusGo test runner")
    parser.add_argument("command", nargs="?", default="all",
                        choices=["unit", "load", "concurrency", "status", "all"],
                        help="which test suite to run (default: all)")
    args = parser.parse_args()

    print(f"{INFO} Kong proxy: {BASE}")
    print(f"{INFO} Kong admin: {ADMIN}")

    cmds = {
        "unit": cmd_unit,
        "load": cmd_load,
        "concurrency": cmd_concurrency,
        "status": cmd_status,
    }

    if args.command == "all":
        results = {}
        for name in ["unit", "load", "concurrency"]:
            results[name] = cmds[name](args)
        cmd_status(args)
        header("OVERALL SUMMARY")
        all_ok = True
        for name, ok in results.items():
            print(f"  {PASS if ok else FAIL} {name}")
            all_ok = all_ok and ok
        sys.exit(0 if all_ok else 1)
    else:
        ok = cmds[args.command](args)
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
