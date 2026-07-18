"""Itinerary planner — the transit algorithm.

Two sources, merged (operator-curated first, then auto-discovered):
  (A) curated_itineraries: chains that realise an operator-published transit
      route (Dhaka -> [Comilla] -> Sylhet), optionally discounted.
  (B) build_itineraries: bounded DFS over a city graph built from trips.

All datetimes are compared in UTC. Trip docs come from the bus_trips ES index.
"""
import logging
import uuid
from datetime import datetime, date, timedelta, timezone

from core.config import settings
from services.es_svc import fetch_trips

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.http_client import ResilientClient

_op_client = ResilientClient()


# ── datetime helpers ─────────────────────────────────────────────────────────
def _parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _norm(s) -> str:
    key = (s or "").strip().lower()
    return {
        "chittagong": "chattogram",
        "comilla": "cumilla",
        "barisal": "barishal",
        "bogra": "bogura",
        "jessore": "jashore",
    }.get(key, key)


def _leg_dict(trip: dict, leg_number: int) -> dict:
    return {
        "leg_number": leg_number,
        "trip_id": str(trip.get("trip_id") or trip.get("id")),
        "bus_id": str(trip.get("bus_id")) if trip.get("bus_id") else None,
        "route_id": str(trip.get("route_id")) if trip.get("route_id") else None,
        "bus_registration_no": trip.get("bus_registration_no"),
        "operator_id": str(trip.get("operator_id")) if trip.get("operator_id") else None,
        "operator_name": trip.get("operator_name"),
        "origin_city": trip.get("origin_city"),
        "destination_city": trip.get("destination_city"),
        "departure_datetime": trip.get("departure_datetime"),
        "arrival_datetime": trip.get("arrival_datetime"),
        "fare_amount": float(trip.get("fare_amount", 0) or 0),
        "bus_type": trip.get("bus_type"),
        "available_seats": int(trip.get("available_seats", 0) or 0),
    }


def _assemble(path: list[dict], *, source: str, discount_pct: float = 0.0,
              transit_route_id=None, transit_route_name=None) -> dict:
    """Turn an ordered list of trip docs into the itinerary output shape."""
    legs = [_leg_dict(t, i + 1) for i, t in enumerate(path)]
    transfers = []
    for i in range(len(path) - 1):
        arrive = _parse_dt(path[i]["arrival_datetime"])
        depart = _parse_dt(path[i + 1]["departure_datetime"])
        transfers.append({
            "city": path[i]["destination_city"],
            "wait_minutes": int((depart - arrive).total_seconds() // 60),
            "arrive": path[i]["arrival_datetime"],
            "depart": path[i + 1]["departure_datetime"],
        })
    total_fare = round(sum(l["fare_amount"] for l in legs), 2)
    first_dep = _parse_dt(path[0]["departure_datetime"])
    last_arr = _parse_dt(path[-1]["arrival_datetime"])
    total_minutes = int((last_arr - first_dep).total_seconds() // 60)
    discount_amount = round(total_fare * (discount_pct / 100.0), 2) if discount_pct else 0.0
    return {
        "itinerary_id": str(uuid.uuid4()),
        "legs": legs,
        "transfers": transfers,
        "total_fare": total_fare,
        "operator_discount_amount": discount_amount,
        "final_fare": round(total_fare - discount_amount, 2),
        "total_duration_minutes": total_minutes,
        "leg_count": len(legs),
        "is_direct": len(legs) == 1,
        "source": source,
        "transit_route_id": str(transit_route_id) if transit_route_id else None,
        "transit_route_name": transit_route_name,
    }


def _score(itin: dict):
    # fewer legs first, then faster, then cheaper
    return (itin["leg_count"], itin["total_duration_minutes"], itin["total_fare"])


def _transfer_ok(prev_arrival: datetime, next_departure: datetime) -> bool:
    wait = (next_departure - prev_arrival).total_seconds() / 60.0
    return settings.MIN_TRANSFER_MINUTES <= wait <= settings.MAX_TRANSFER_WAIT_HOURS * 60


# ── (A) operator-curated itineraries ─────────────────────────────────────────
async def _fetch_transit_routes(origin: str, destination: str) -> list[dict]:
    try:
        data = await _op_client.get_json(
            f"{settings.OPERATOR_SERVICE_URL}/transit-routes/",
            params={"origin": origin, "destination": destination},
            timeout=6.0,
        )
        return (data.get("data", []) if isinstance(data, dict) else []) or []
    except Exception as e:
        logging.error(f"Could not fetch transit routes: {e}")
        return []


def _chain_for_sequence(cities: list[str], trips: list[dict], journey_date: date,
                        preferred_operator: str | None,
                        leg_assignments: list[dict] | None = None) -> list[dict] | None:
    """Greedy chain of trips realising an ordered city sequence. Returns the
    ordered trip docs, or None if no valid chain exists."""
    by_pair: dict[tuple, list[dict]] = {}
    for t in trips:
        by_pair.setdefault((_norm(t.get("origin_city")), _norm(t.get("destination_city"))), []).append(t)

    path: list[dict] = []
    prev_arrival: datetime | None = None
    for i in range(len(cities) - 1):
        candidates = by_pair.get((_norm(cities[i]), _norm(cities[i + 1])), [])
        assignment = leg_assignments[i] if leg_assignments and i < len(leg_assignments) else None
        if assignment:
            candidates = [t for t in candidates if (
                str(t.get("bus_id")) == str(assignment.get("bus_id"))
                and str(t.get("route_id")) == str(assignment.get("route_id"))
            )]
        # prefer the route's operator, earliest valid departure, seats available
        def _key(t):
            return (
                0 if preferred_operator and str(t.get("operator_id")) == str(preferred_operator) else 1,
                _parse_dt(t["departure_datetime"]),
            )
        chosen = None
        for t in sorted(candidates, key=_key):
            if int(t.get("available_seats", 0) or 0) <= 0:
                continue
            dep = _parse_dt(t["departure_datetime"])
            if prev_arrival is None:
                if dep.date() != journey_date:
                    continue
            elif not _transfer_ok(prev_arrival, dep):
                continue
            chosen = t
            break
        if chosen is None:
            return None
        path.append(chosen)
        prev_arrival = _parse_dt(chosen["arrival_datetime"])
    return path


def _slice_curated_route(route: dict, origin: str, destination: str):
    """Return only the requested ordered portion of a published through-route.

    Dhaka -> Chattogram -> Cox's Bazar can therefore serve both Dhaka ->
    Chattogram (one bus) and Dhaka -> Cox's Bazar (two buses).
    """
    full_cities = [route.get("origin_city"), *(route.get("via_cities") or []), route.get("destination_city")]
    keys = [_norm(city) for city in full_cities]
    try:
        start = keys.index(_norm(origin))
        end = keys.index(_norm(destination), start + 1)
    except ValueError:
        return None, None
    assignments = route.get("leg_assignments") or []
    sliced_assignments = assignments[start:end] if len(assignments) == len(full_cities) - 1 else []
    return full_cities[start:end + 1], sliced_assignments


async def curated_itineraries(origin: str, destination: str, journey_date: date,
                              trips: list[dict]) -> list[dict]:
    routes = await _fetch_transit_routes(origin, destination)
    out = []
    for r in routes:
        if not r.get("is_active", True):
            continue
        cities, assignments = _slice_curated_route(r, origin, destination)
        if not cities:
            continue
        path = _chain_for_sequence(
            cities, trips, journey_date, r.get("operator_id"), assignments
        )
        if not path:
            continue
        out.append(_assemble(
            path, source="operator",
            discount_pct=float(r.get("combined_discount_pct", 0) or 0),
            transit_route_id=r.get("id"),
            transit_route_name=r.get("name"),
        ))
    return out


# ── (B) auto-discovered itineraries ──────────────────────────────────────────
def build_itineraries(origin: str, destination: str, journey_date: date,
                      trips: list[dict]) -> list[dict]:
    O, D = _norm(origin), _norm(destination)

    # Multi-leg (connecting) use only allows trips whose operator opted in.
    connectable = [t for t in trips if t.get("allow_transit", True) is not False]

    adjacency: dict[str, list[dict]] = {}
    for t in connectable:
        adjacency.setdefault(_norm(t.get("origin_city")), []).append(t)
    for lst in adjacency.values():
        lst.sort(key=lambda t: _parse_dt(t["departure_datetime"]))

    results: list[list[dict]] = []

    def dfs(city: str, arrived_at: datetime | None, path: list[dict], visited: set[str]):
        if len(path) > settings.MAX_LEGS:
            return
        if city == D and path:
            results.append(path.copy())
            return
        for trip in adjacency.get(city, []):
            dest = _norm(trip.get("destination_city"))
            if dest in visited:
                continue  # no loops
            dep = _parse_dt(trip["departure_datetime"])
            if arrived_at is not None:
                if not _transfer_ok(arrived_at, dep):
                    continue
            else:
                if dep.date() != journey_date:
                    continue  # first leg must depart on the requested date
            if int(trip.get("available_seats", 0) or 0) <= 0:
                continue
            path.append(trip)
            visited.add(dest)
            dfs(dest, _parse_dt(trip["arrival_datetime"]), path, visited)
            path.pop()
            visited.remove(dest)

    dfs(O, None, [], {O})
    itineraries = [_assemble(p, source="auto") for p in results]
    itineraries.sort(key=_score)
    return itineraries


# ── merge ─────────────────────────────────────────────────────────────────────
async def plan(origin: str, destination: str, journey_date: date) -> list[dict]:
    # window: journey_date 00:00 .. journey_date+1 06:00 (late-night last legs)
    start = datetime(journey_date.year, journey_date.month, journey_date.day, tzinfo=timezone.utc)
    end = start + timedelta(days=1, hours=6)
    trips = await fetch_trips(start.isoformat(), end.isoformat())
    if not trips:
        return []

    curated = await curated_itineraries(origin, destination, journey_date, trips)
    curated.sort(key=_score)
    auto = build_itineraries(origin, destination, journey_date, trips)

    # dedupe: drop auto itineraries whose exact trip-id sequence is already curated
    curated_seqs = {tuple(l["trip_id"] for l in it["legs"]) for it in curated}
    merged = list(curated)
    for it in auto:
        if tuple(l["trip_id"] for l in it["legs"]) in curated_seqs:
            continue
        merged.append(it)

    return merged[: settings.MAX_ITINERARIES_RETURNED]
