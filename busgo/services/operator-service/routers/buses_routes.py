from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID

from database import get_db
from models.models import Bus, Route, Operator
from schemas.schemas import BusCreate, BusUpdate, BusResponse, RouteCreate, RouteResponse
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
    if not op_res.scalars().first():
        raise HTTPException(status_code=404, detail="Operator not found")
        
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
    if not op_res.scalars().first():
        raise HTTPException(status_code=404, detail="Operator not found")
        
    # Convert Points to dict for JSON injection
    route_data = req.model_dump()
    route_data["boarding_points"] = [p for p in route_data["boarding_points"]]
    route_data["dropping_points"] = [p for p in route_data["dropping_points"]]
    
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
