from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID

from database import get_db
from models.models import Bus, Route, Operator, Trip
from schemas.schemas import BusCreate, BusUpdate, BusResponse, RouteCreate, RouteUpdate, RouteResponse
from api.deps import get_current_user_payload

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse

router = APIRouter(tags=["buses-routes"])

@router.post("/operators/{id}/buses", response_model=BaseResponse[BusResponse])
async def create_bus(id: UUID, req: BusCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    # Verify operator exists
    op_res = await db.execute(select(Operator).where(Operator.id == id))
    operator = op_res.scalars().first()
    if not operator:
        # Auto-create Operator
        operator = Operator(
            id=id,
            name=payload.get("phone", "Auto Operator"),
            contact_phone=payload.get("phone", "Unknown"),
            contact_email="operator@example.com",
            address="Not specified",
            license_no="PENDING"
        )
        db.add(operator)
        await db.commit()
        await db.refresh(operator)
        
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
    for key, value in update_data.items():
        setattr(bus, key, value)
        
    await db.commit()
    await db.refresh(bus)
    return BaseResponse(success=True, data=BusResponse.model_validate(bus), message="Bus updated")

@router.post("/operators/{id}/routes", response_model=BaseResponse[RouteResponse])
async def create_route(id: UUID, req: RouteCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    op_res = await db.execute(select(Operator).where(Operator.id == id))
    operator = op_res.scalars().first()
    if not operator:
        # Auto-create Operator
        operator = Operator(
            id=id,
            name=payload.get("phone", "Auto Operator"),
            contact_phone=payload.get("phone", "Unknown"),
            contact_email="operator@example.com",
            address="Not specified",
            license_no="PENDING"
        )
        db.add(operator)
        await db.commit()
        await db.refresh(operator)
        
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
