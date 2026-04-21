from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from database import get_db
from models.models import Trip, TripStatus, Bus, Route, Operator
from schemas.schemas import TripCreate, TripUpdate, TripResponse
from api.deps import get_current_user_payload

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.kafka_producer import KafkaProducerClient

router = APIRouter(prefix="/trips", tags=["trips"])

@router.post("/", response_model=BaseResponse[TripResponse])
async def create_trip(req: TripCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    # Verify relations
    op_res = await db.execute(select(Operator).where(Operator.id == req.operator_id))
    if not op_res.scalars().first(): raise HTTPException(status_code=404, detail="Operator not found")
    
    bus_res = await db.execute(select(Bus).where(Bus.id == req.bus_id, Bus.operator_id == req.operator_id))
    if not bus_res.scalars().first(): raise HTTPException(status_code=404, detail="Bus not found for operator")
        
    route_res = await db.execute(select(Route).where(Route.id == req.route_id, Route.operator_id == req.operator_id))
    if not route_res.scalars().first(): raise HTTPException(status_code=404, detail="Route not found for operator")

    trip = Trip(**req.model_dump())
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return BaseResponse(success=True, data=TripResponse.model_validate(trip), message="Trip scheduled")

@router.get("/{id}", response_model=BaseResponse[TripResponse])
async def get_trip(id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Trip).where(Trip.id == id))
    trip = result.scalars().first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return BaseResponse(success=True, data=TripResponse.model_validate(trip))

@router.get("/", response_model=BaseResponse[List[TripResponse]])
async def list_trips(
    operator_id: Optional[UUID] = None,
    date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Trip)
    if operator_id:
        query = query.where(Trip.operator_id == operator_id)
    if date:
        # Ideally filter by date range for the day, but matching exact here as placeholder
        query = query.where(Trip.departure_datetime >= date)
        
    result = await db.execute(query)
    trips = result.scalars().all()
    return BaseResponse(success=True, data=[TripResponse.model_validate(trip) for trip in trips])

@router.put("/{id}", response_model=BaseResponse[TripResponse])
async def update_trip(id: UUID, req: TripUpdate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    result = await db.execute(select(Trip).where(Trip.id == id))
    trip = result.scalars().first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(trip, key, value)
        
    await db.commit()
    await db.refresh(trip)
    return BaseResponse(success=True, data=TripResponse.model_validate(trip), message="Trip updated")

@router.post("/{id}/cancel", response_model=BaseResponse)
async def cancel_trip(id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    result = await db.execute(select(Trip).where(Trip.id == id))
    trip = result.scalars().first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.status == TripStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Trip already cancelled")
        
    trip.status = TripStatus.CANCELLED
    await db.commit()

    # Publish Kafka events
    try:
        await KafkaProducerClient.publish("booking.cancelled", {
            "trip_id": str(trip.id),
            "operator_id": str(trip.operator_id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "reason": "Trip cancelled by operator"
        })
        
        await KafkaProducerClient.publish("audit.log", {
            "event": "trip.cancelled",
            "trip_id": str(trip.id),
            "user_id": payload.get("user_id"),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        print(f"Kafka publish failed: {e}")

    return BaseResponse(success=True, message=f"Trip {id} cancelled, refund initiated for related bookings.")
