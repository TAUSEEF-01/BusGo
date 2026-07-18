from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID

from database import get_db
from models.models import Bus, Route, Operator, Trip, TransitRoute
from schemas.schemas import BusCreate, BusUpdate, BusResponse, RouteCreate, RouteUpdate, RouteResponse
from api.deps import get_current_user_payload

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse

router = APIRouter(tags=["buses-routes"])


def _require_operator_access(operator_id: UUID, payload: dict) -> None:
    role = str(payload.get("role") or "").upper()
    if role == "ADMIN":
        return
    if role != "OPERATOR" or str(payload.get("user_id")) != str(operator_id):
        raise HTTPException(status_code=403, detail="Cannot manage another operator's resources")


def _operator_profile_values(operator_id: UUID, payload: dict) -> dict:
    phone = str(payload.get("phone") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    full_name = str(payload.get("full_name") or "").strip()
    fallback_name = f"Operator {str(operator_id)[:8].upper()}"
    return {
        "name": full_name or (email.split("@", 1)[0] if email else "") or phone or fallback_name,
        "contact_phone": phone or "Not provided",
        "contact_email": email or f"operator-{operator_id}@users.busgo.local",
        "address": "Not specified",
        "license_no": "PENDING",
    }


async def _ensure_operator(operator_id: UUID, db: AsyncSession, payload: dict) -> Operator:
    operator = (await db.execute(
        select(Operator).where(Operator.id == operator_id)
    )).scalars().first()
    if operator:
        return operator

    operator = Operator(id=operator_id, **_operator_profile_values(operator_id, payload))
    db.add(operator)
    # Keep profile creation atomic with the bus/route being created by the
    # caller. If that insert fails, the new placeholder profile rolls back too.
    await db.flush()
    await db.refresh(operator)
    return operator


async def _transit_route_using_bus(db: AsyncSession, bus: Bus):
    routes = (await db.execute(
        select(TransitRoute).where(TransitRoute.operator_id == bus.operator_id)
    )).scalars().all()
    return next((route for route in routes if any(
        str(item.get("bus_id")) == str(bus.id) for item in (route.leg_assignments or [])
    )), None)


async def _transit_route_using_service_route(db: AsyncSession, route: Route):
    routes = (await db.execute(
        select(TransitRoute).where(TransitRoute.operator_id == route.operator_id)
    )).scalars().all()
    return next((transit_route for transit_route in routes if any(
        str(item.get("route_id")) == str(route.id) for item in (transit_route.leg_assignments or [])
    )), None)

@router.post("/operators/{id}/buses", response_model=BaseResponse[BusResponse])
async def create_bus(id: UUID, req: BusCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    _require_operator_access(id, payload)
    await _ensure_operator(id, db, payload)
        
    bus = Bus(operator_id=id, **req.model_dump())
    db.add(bus)
    try:
        await db.commit()
        await db.refresh(bus)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Registration number might already exist")
        
    return BaseResponse(success=True, data=BusResponse.model_validate(bus), message="Bus created")

@router.get("/operators/{id}/buses", response_model=BaseResponse[List[BusResponse]])
async def list_operator_buses(id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bus).where(Bus.operator_id == id))
    buses = result.scalars().all()
    return BaseResponse(success=True, data=[BusResponse.model_validate(b) for b in buses])

@router.put("/buses/{id}", response_model=BaseResponse[BusResponse])
async def update_bus(id: UUID, req: BusUpdate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    result = await db.execute(select(Bus).where(Bus.id == id))
    bus = result.scalars().first()
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    
    update_data = req.model_dump(exclude_unset=True)
    if update_data.get("allow_transit") is False and bus.allow_transit:
        transit_route = await _transit_route_using_bus(db, bus)
        if transit_route:
            raise HTTPException(status_code=400, detail=f"Remove this bus from transit route '{transit_route.name}' before disabling transit service")
    for key, value in update_data.items():
        setattr(bus, key, value)
        
    await db.commit()
    await db.refresh(bus)
    return BaseResponse(success=True, data=BusResponse.model_validate(bus), message="Bus updated")

@router.post("/operators/{id}/routes", response_model=BaseResponse[RouteResponse])
async def create_route(id: UUID, req: RouteCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    _require_operator_access(id, payload)
    await _ensure_operator(id, db, payload)
        
    # Convert Points to dict for JSON injection
    route_data = req.model_dump()
    route_data["boarding_points"] = [p for p in route_data["boarding_points"]]
    route_data["dropping_points"] = [p for p in route_data["dropping_points"]]
    
    # Check for exact duplicate route to ensure idempotency
    existing_stmt = select(Route).where(
        Route.operator_id == id,
        Route.origin_city == req.origin_city,
        Route.destination_city == req.destination_city
    )
    existing_res = await db.execute(existing_stmt)
    for existing_route in existing_res.scalars().all():
        if (existing_route.boarding_points == route_data["boarding_points"] and 
            existing_route.dropping_points == route_data["dropping_points"] and
            abs(existing_route.distance_km - req.distance_km) < 0.1):
            return BaseResponse(success=True, data=RouteResponse.model_validate(existing_route), message="Route already exists")

    route = Route(operator_id=id, **route_data)
    db.add(route)
    await db.commit()
    await db.refresh(route)
    return BaseResponse(success=True, data=RouteResponse.model_validate(route), message="Route created")

@router.get("/operators/{id}/routes", response_model=BaseResponse[List[RouteResponse]])
async def list_operator_routes(id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Route).where(Route.operator_id == id))
    routes = result.scalars().all()
    return BaseResponse(success=True, data=[RouteResponse.model_validate(r) for r in routes])

@router.put("/routes/{id}", response_model=BaseResponse[RouteResponse])
async def update_route(id: UUID, req: RouteUpdate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    result = await db.execute(select(Route).where(Route.id == id))
    route = result.scalars().first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    update_data = req.model_dump(exclude_unset=True)
    if (
        ("origin_city" in update_data and update_data["origin_city"] != route.origin_city)
        or ("destination_city" in update_data and update_data["destination_city"] != route.destination_city)
    ):
        transit_route = await _transit_route_using_service_route(db, route)
        if transit_route:
            raise HTTPException(status_code=400, detail=f"Remove this service route from transit route '{transit_route.name}' before changing its cities")
    if "boarding_points" in update_data:
        update_data["boarding_points"] = [p for p in update_data["boarding_points"]]
    if "dropping_points" in update_data:
        update_data["dropping_points"] = [p for p in update_data["dropping_points"]]

    for key, value in update_data.items():
        setattr(route, key, value)
        
    await db.commit()
    await db.refresh(route)
    return BaseResponse(success=True, data=RouteResponse.model_validate(route), message="Route updated")

@router.get("/routes/", response_model=BaseResponse[List[RouteResponse]])
async def list_all_routes(
    origin: Optional[str] = None, 
    destination: Optional[str] = None, 
    db: AsyncSession = Depends(get_db)
):
    query = select(Route)
    if origin:
        query = query.where(Route.origin_city == origin)
    if destination:
        query = query.where(Route.destination_city == destination)
        
    result = await db.execute(query)
    routes = result.scalars().all()
    return BaseResponse(success=True, data=[RouteResponse.model_validate(r) for r in routes])

@router.delete("/buses/{id}", response_model=BaseResponse)
async def delete_bus(id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    result = await db.execute(select(Bus).where(Bus.id == id))
    bus = result.scalars().first()
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    transit_route = await _transit_route_using_bus(db, bus)
    if transit_route:
        raise HTTPException(status_code=400, detail=f"Bus is assigned to transit route '{transit_route.name}'")
    try:
        await db.delete(bus)
        await db.commit()
        return BaseResponse(success=True, message="Bus deleted successfully")
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Cannot delete bus because it has scheduled trips.")

@router.delete("/routes/{id}", response_model=BaseResponse)
async def delete_route(id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    result = await db.execute(select(Route).where(Route.id == id))
    route = result.scalars().first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    transit_route = await _transit_route_using_service_route(db, route)
    if transit_route:
        raise HTTPException(status_code=400, detail=f"Route is assigned to transit route '{transit_route.name}'")
        
    # Check if any associated trips have sold tickets
    trips_res = await db.execute(
        select(Trip, Bus)
        .join(Bus, Trip.bus_id == Bus.id)
        .where(Trip.route_id == id)
    )
    trips_list = trips_res.all()
    for trip, bus in trips_list:
        if trip.available_seats < bus.total_seats:
            raise HTTPException(status_code=400, detail="Cannot delete route because one of its scheduled trips has sold tickets.")

    try:
        await db.delete(route)
        await db.commit()
        return BaseResponse(success=True, message="Route deleted successfully")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to delete route: {str(e)}")
