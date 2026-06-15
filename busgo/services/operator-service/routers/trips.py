from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from database import get_db
from models.models import Trip, TripStatus, Bus, Route, Operator
from schemas.schemas import TripCreate, TripUpdate, TripResponse, TripEnrichedResponse
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

@router.get("/{id}", response_model=BaseResponse[TripEnrichedResponse])
async def get_trip(id: UUID, db: AsyncSession = Depends(get_db)):
    query = (
        select(Trip, Operator, Bus, Route)
        .select_from(Trip)
        .join(Operator, Trip.operator_id == Operator.id)
        .join(Bus, Trip.bus_id == Bus.id)
        .join(Route, Trip.route_id == Route.id)
        .where(Trip.id == id)
    )
    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    trip, operator, bus, route = row
    trip_dict = TripResponse.model_validate(trip).model_dump()
    trip_dict['operator_name'] = operator.name
    trip_dict['bus_type'] = bus.bus_type.value
    trip_dict['amenities'] = bus.amenities
    trip_dict['origin_city'] = route.origin_city
    trip_dict['destination_city'] = route.destination_city
    trip_dict['boarding_points'] = route.boarding_points
    trip_dict['dropping_points'] = route.dropping_points
    trip_dict['trip_id'] = str(trip.id)
    
    # Dynamically fetch available seats count from database
    counts_res = await db.execute(
        text("""
            SELECT 
                COUNT(*) FILTER (WHERE status = 'AVAILABLE') as avail_count,
                COUNT(*) as total_inv_count
            FROM seat_inventory
            WHERE trip_id = :trip_id
        """),
        {"trip_id": trip.id}
    )
    counts_row = counts_res.first()
    if counts_row and counts_row.total_inv_count > 0:
        trip_dict['available_seats'] = counts_row.avail_count
    else:
        trip_dict['available_seats'] = bus.total_seats
        
    return BaseResponse(success=True, data=trip_dict)

@router.get("/", response_model=BaseResponse[List[TripEnrichedResponse]])
async def list_trips(
    operator_id: Optional[UUID] = None,
    date: Optional[datetime] = None,
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Trip, Operator, Bus, Route)
        .select_from(Trip)
        .join(Operator, Trip.operator_id == Operator.id)
        .join(Bus, Trip.bus_id == Bus.id)
        .join(Route, Trip.route_id == Route.id)
    )
    
    if operator_id:
        query = query.where(Trip.operator_id == operator_id)
    if date:
        # Filter by date (ignoring time)
        query = query.where(Trip.departure_datetime >= date)
    if origin:
        query = query.where(Route.origin_city == origin)
    if destination:
        query = query.where(Route.destination_city == destination)
        
    result = await db.execute(query)
    rows = result.all()
    
    # Dynamically fetch available seats count from database
    counts_res = await db.execute(
        text("""
            SELECT 
                trip_id,
                COUNT(*) FILTER (WHERE status = 'AVAILABLE') as avail_count,
                COUNT(*) as total_inv_count
            FROM seat_inventory
            GROUP BY trip_id
        """)
    )
    counts_map = {row.trip_id: (row.avail_count, row.total_inv_count) for row in counts_res.all()}

    # Build enriched response
    enriched_trips = []
    for trip, operator, bus, route in rows:
        trip_dict = TripResponse.model_validate(trip).model_dump()
        trip_dict['operator_name'] = operator.name
        trip_dict['bus_type'] = bus.bus_type.value
        trip_dict['amenities'] = bus.amenities
        trip_dict['origin_city'] = route.origin_city
        trip_dict['destination_city'] = route.destination_city
        trip_dict['trip_id'] = str(trip.id)
        
        # Calculate available seats dynamically from seat_inventory table
        avail_info = counts_map.get(trip.id)
        if avail_info:
            avail_count, total_inv_count = avail_info
            if total_inv_count > 0:
                trip_dict['available_seats'] = avail_count
            else:
                trip_dict['available_seats'] = bus.total_seats
        else:
            trip_dict['available_seats'] = bus.total_seats
            
        enriched_trips.append(trip_dict)
    
    return BaseResponse(success=True, data=enriched_trips)

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

@router.delete("/{id}", response_model=BaseResponse)
async def delete_trip(id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    result = await db.execute(
        select(Trip, Bus)
        .join(Bus, Trip.bus_id == Bus.id)
        .where(Trip.id == id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    trip, bus = row
    
    if trip.available_seats < bus.total_seats:
        raise HTTPException(status_code=400, detail="Cannot delete trip because tickets have already been sold.")
        
    # Clean up corresponding seat inventory in seat_inventory table
    from sqlalchemy import text
    try:
        await db.execute(text("DELETE FROM seat_inventory WHERE trip_id = :trip_id"), {"trip_id": id})
    except Exception as e:
        print(f"Failed to clean up seat inventory: {e}")
        
    await db.delete(trip)
    await db.commit()
    return BaseResponse(success=True, message="Trip deleted successfully")
