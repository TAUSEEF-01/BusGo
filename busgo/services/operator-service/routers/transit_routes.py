"""Operator-published transit routes (curated connections).

An operator publishes a route like "Dhaka -> [Comilla] -> Sylhet" with an
optional combined-fare discount. transit-service reads active routes (the public
GET) and ranks realisable ones above auto-discovered itineraries.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from typing import Optional, List
from uuid import UUID

from database import get_db
from models.models import TransitRoute
from schemas.schemas import TransitRouteCreate, TransitRouteUpdate, TransitRouteResponse
from api.deps import get_current_user_payload

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse

router = APIRouter(prefix="/transit-routes", tags=["transit-routes"])


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
    if not origin or not destination or origin.strip().lower() == destination.strip().lower():
        raise HTTPException(status_code=400, detail="origin and destination must differ")
    if not via_cities or not (1 <= len(via_cities) <= 2):
        raise HTTPException(status_code=400, detail="via_cities must contain 1 or 2 cities")
    seq = [origin.strip().lower(), *[c.strip().lower() for c in via_cities], destination.strip().lower()]
    if len(set(seq)) != len(seq):
        raise HTTPException(status_code=400, detail="a city cannot repeat in the route")
    if discount is not None and not (0 <= discount <= 50):
        raise HTTPException(status_code=400, detail="combined_discount_pct must be between 0 and 50")


@router.get("/", response_model=BaseResponse[List[TransitRouteResponse]])
async def list_transit_routes(
    origin: Optional[str] = Query(None),
    destination: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """PUBLIC — active routes matching origin+destination (case-insensitive).
    transit-service calls this. No filters returns all active routes."""
    q = select(TransitRoute).where(TransitRoute.is_active == True)  # noqa: E712
    if origin:
        q = q.where(func.lower(TransitRoute.origin_city) == origin.strip().lower())
    if destination:
        q = q.where(func.lower(TransitRoute.destination_city) == destination.strip().lower())
    rows = (await db.execute(q)).scalars().all()
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
    route = TransitRoute(
        operator_id=req.operator_id, name=req.name.strip(),
        origin_city=req.origin_city.strip(), destination_city=req.destination_city.strip(),
        via_cities=[c.strip() for c in req.via_cities],
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
    new_name = data.get("name", route.name)
    new_origin = data.get("origin_city", route.origin_city)
    new_dest = data.get("destination_city", route.destination_city)
    new_via = data.get("via_cities", route.via_cities)
    new_disc = data.get("combined_discount_pct", route.combined_discount_pct)
    _validate(new_name, new_origin, new_dest, new_via, new_disc)

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
