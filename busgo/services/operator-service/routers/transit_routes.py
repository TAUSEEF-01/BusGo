"""Operator-published transit routes (curated connections).

An operator publishes a route like "Dhaka -> [Comilla] -> Sylhet" with an
optional combined-fare discount. transit-service reads active routes (the public
GET) and ranks realisable ones above auto-discovered itineraries.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional, List
from uuid import UUID

from database import get_db
from models.models import Bus, Route, TransitRoute
from schemas.schemas import TransitRouteCreate, TransitRouteUpdate, TransitRouteResponse
from api.deps import get_current_user_payload

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse

router = APIRouter(prefix="/transit-routes", tags=["transit-routes"])

_CITY_ALIASES = {
    "chittagong": "chattogram",
    "comilla": "cumilla",
    "barisal": "barishal",
    "bogra": "bogura",
    "jessore": "jashore",
}


def _city_key(value: str) -> str:
    key = (value or "").strip().lower()
    return _CITY_ALIASES.get(key, key)


def _require_operator(payload: dict):
    role = str(payload.get("role", "")).upper()
    if role not in ("OPERATOR", "ADMIN"):
        raise HTTPException(status_code=403, detail="Operator or admin access required")


def _owns_or_admin(payload: dict, operator_id) -> bool:
    role = str(payload.get("role", "")).upper()
    return role == "ADMIN" or str(payload.get("user_id")) == str(operator_id)


def _validate(name, origin, destination, via_cities, discount):
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="name is required")
    if (
        not origin
        or not origin.strip()
        or not destination
        or not destination.strip()
        or _city_key(origin) == _city_key(destination)
    ):
        raise HTTPException(status_code=400, detail="origin and destination must differ")
    if not via_cities or not (1 <= len(via_cities) <= 2):
        raise HTTPException(status_code=400, detail="via_cities must contain 1 or 2 cities")
    if any(not city or not city.strip() for city in via_cities):
        raise HTTPException(status_code=400, detail="transit locations cannot be empty")
    seq = [_city_key(origin), *[_city_key(c) for c in via_cities], _city_key(destination)]
    if len(set(seq)) != len(seq):
        raise HTTPException(status_code=400, detail="a city cannot repeat in the route")
    if discount is not None and not (0 <= discount <= 50):
        raise HTTPException(status_code=400, detail="combined_discount_pct must be between 0 and 50")


def _assignment_data(assignments) -> list[dict]:
    return [
        {
            "bus_id": str(item.bus_id if hasattr(item, "bus_id") else item["bus_id"]),
            "route_id": str(item.route_id if hasattr(item, "route_id") else item["route_id"]),
        }
        for item in (assignments or [])
    ]


async def _validate_leg_assignments(db: AsyncSession, operator_id, cities: list[str], assignments: list[dict]):
    if len(assignments) != len(cities) - 1:
        raise HTTPException(status_code=400, detail="Select one bus and service route for every transit leg")

    try:
        bus_ids = [UUID(str(item["bus_id"])) for item in assignments]
        route_ids = [UUID(str(item["route_id"])) for item in assignments]
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Every transit leg requires a valid bus and service route")

    buses = (await db.execute(
        select(Bus).where(Bus.id.in_(bus_ids), Bus.operator_id == operator_id)
    )).scalars().all()
    routes = (await db.execute(
        select(Route).where(Route.id.in_(route_ids), Route.operator_id == operator_id)
    )).scalars().all()
    buses_by_id = {str(bus.id): bus for bus in buses}
    routes_by_id = {str(route.id): route for route in routes}

    for index, assignment in enumerate(assignments):
        bus = buses_by_id.get(str(assignment["bus_id"]))
        route = routes_by_id.get(str(assignment["route_id"]))
        leg_label = f"{cities[index]} to {cities[index + 1]}"
        if not bus:
            raise HTTPException(status_code=400, detail=f"The selected bus for {leg_label} does not belong to this operator")
        if not bus.is_active or not bus.allow_transit:
            raise HTTPException(status_code=400, detail=f"Bus {bus.registration_no} is not enabled for transit service")
        if not route:
            raise HTTPException(status_code=400, detail=f"The selected service route for {leg_label} is invalid")
        if _city_key(route.origin_city) != _city_key(cities[index]) or _city_key(route.destination_city) != _city_key(cities[index + 1]):
            raise HTTPException(status_code=400, detail=f"The selected service route does not match {leg_label}")


@router.get("/", response_model=BaseResponse[List[TransitRouteResponse]])
async def list_transit_routes(
    origin: Optional[str] = Query(None),
    destination: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """PUBLIC — active routes matching origin+destination (case-insensitive).
    transit-service calls this. No filters returns all active routes."""
    q = select(TransitRoute).where(TransitRoute.is_active == True)  # noqa: E712
    rows = (await db.execute(q)).scalars().all()
    if origin or destination:
        filtered = []
        for route in rows:
            sequence = [route.origin_city, *(route.via_cities or []), route.destination_city]
            keys = [_city_key(city) for city in sequence]
            try:
                start = keys.index(_city_key(origin)) if origin else 0
                end = keys.index(_city_key(destination), start + 1) if destination else len(keys) - 1
            except ValueError:
                continue
            if start < end:
                filtered.append(route)
        rows = filtered
    return BaseResponse(success=True, data=[TransitRouteResponse.model_validate(r) for r in rows])


@router.get("/mine", response_model=BaseResponse[List[TransitRouteResponse]])
async def my_transit_routes(db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    _require_operator(payload)
    q = select(TransitRoute).where(TransitRoute.operator_id == payload.get("user_id")).order_by(TransitRoute.created_at.desc())
    rows = (await db.execute(q)).scalars().all()
    return BaseResponse(success=True, data=[TransitRouteResponse.model_validate(r) for r in rows])


@router.post("/", response_model=BaseResponse[TransitRouteResponse])
async def create_transit_route(req: TransitRouteCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    _require_operator(payload)
    if not _owns_or_admin(payload, req.operator_id):
        raise HTTPException(status_code=403, detail="Cannot create a route for another operator")
    _validate(req.name, req.origin_city, req.destination_city, req.via_cities, req.combined_discount_pct)
    assignments = _assignment_data(req.leg_assignments)
    cities = [req.origin_city.strip(), *[city.strip() for city in req.via_cities], req.destination_city.strip()]
    await _validate_leg_assignments(db, req.operator_id, cities, assignments)
    route = TransitRoute(
        operator_id=req.operator_id, name=req.name.strip(),
        origin_city=req.origin_city.strip(), destination_city=req.destination_city.strip(),
        via_cities=[c.strip() for c in req.via_cities],
        leg_assignments=assignments,
        combined_discount_pct=req.combined_discount_pct or 0.0,
        is_active=req.is_active if req.is_active is not None else True,
    )
    db.add(route)
    await db.commit()
    await db.refresh(route)
    return BaseResponse(success=True, data=TransitRouteResponse.model_validate(route), message="Transit route created")


@router.put("/{id}", response_model=BaseResponse[TransitRouteResponse])
async def update_transit_route(id: UUID, req: TransitRouteUpdate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    _require_operator(payload)
    route = (await db.execute(select(TransitRoute).where(TransitRoute.id == id))).scalars().first()
    if not route:
        raise HTTPException(status_code=404, detail="Transit route not found")
    if not _owns_or_admin(payload, route.operator_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    data = req.model_dump(exclude_unset=True)
    for field in ("name", "origin_city", "destination_city"):
        if field in data and data[field] is not None:
            data[field] = data[field].strip()
    if "via_cities" in data and data["via_cities"] is not None:
        data["via_cities"] = [city.strip() for city in data["via_cities"]]
    if "leg_assignments" in data and data["leg_assignments"] is not None:
        data["leg_assignments"] = _assignment_data(data["leg_assignments"])
    new_name = data.get("name", route.name)
    new_origin = data.get("origin_city", route.origin_city)
    new_dest = data.get("destination_city", route.destination_city)
    new_via = data.get("via_cities", route.via_cities)
    new_disc = data.get("combined_discount_pct", route.combined_discount_pct)
    _validate(new_name, new_origin, new_dest, new_via, new_disc)

    structural_fields = {"origin_city", "destination_city", "via_cities", "leg_assignments"}
    if structural_fields.intersection(data):
        new_assignments = data.get("leg_assignments", route.leg_assignments or [])
        cities = [new_origin, *new_via, new_dest]
        await _validate_leg_assignments(db, route.operator_id, cities, new_assignments)

    for k, v in data.items():
        setattr(route, k, v)
    await db.commit()
    await db.refresh(route)
    return BaseResponse(success=True, data=TransitRouteResponse.model_validate(route), message="Transit route updated")


@router.delete("/{id}", response_model=BaseResponse)
async def delete_transit_route(id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    _require_operator(payload)
    route = (await db.execute(select(TransitRoute).where(TransitRoute.id == id))).scalars().first()
    if not route:
        raise HTTPException(status_code=404, detail="Transit route not found")
    if not _owns_or_admin(payload, route.operator_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.delete(route)
    await db.commit()
    return BaseResponse(success=True, message="Transit route deleted")
