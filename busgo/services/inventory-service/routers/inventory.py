from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict
from uuid import UUID
from datetime import datetime, timezone, timedelta

from database import get_db
from models.models import SeatInventory, SeatStatus, SeatType
from schemas.schemas import (SeatResponse, LockRequest, LockResponse, 
                             ReleaseRequest, ConfirmRequest, InitializeRequest)
from api.deps import get_current_user_payload
from services.redis_svc import RedisInventoryService

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.exceptions import SeatAlreadyLocked

router = APIRouter(prefix="/inventory/trips", tags=["inventory"])

@router.post("/{trip_id}/initialize", response_model=BaseResponse)
async def initialize_inventory(trip_id: UUID, req: InitializeRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SeatInventory).where(SeatInventory.trip_id == trip_id))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Inventory already initialized for this trip")

    seats = []
    for s_info in req.seat_layout:
        seats.append(SeatInventory(
            trip_id=trip_id,
            seat_number=s_info["number"],
            seat_type=SeatType(s_info["type"]),
            status=SeatStatus.AVAILABLE
        ))
    db.add_all(seats)
    await db.commit()
    return BaseResponse(success=True, message="Inventory initialized")

@router.get("/{trip_id}/seats", response_model=BaseResponse[List[SeatResponse]])
async def get_seats(trip_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SeatInventory).where(SeatInventory.trip_id == trip_id))
    seats = result.scalars().all()
    
    # Auto-initialize a default layout if not found (Hack for prototype logic when operators forgot)
    if not seats:
        new_seats = []
        for row in range(10):
            row_letter = chr(65 + row)
            for col in range(4):
                seat_number = f"{row_letter}{col+1}"
                new_seats.append(SeatInventory(
                    trip_id=trip_id,
                    seat_number=seat_number,
                    seat_type=SeatType.WINDOW if col in [0, 3] else SeatType.AISLE,
                    status=SeatStatus.AVAILABLE
                ))
        db.add_all(new_seats)
        await db.commit()
        
        result = await db.execute(select(SeatInventory).where(SeatInventory.trip_id == trip_id))
        seats = result.scalars().all()
        
    # Overlay Redis locks
    for seat in seats:
        if seat.status == SeatStatus.AVAILABLE:
            booking_id = await RedisInventoryService.get_seat_lock(str(trip_id), seat.seat_number)
            if booking_id:
                seat.status = SeatStatus.LOCKED
                seat.locked_by_booking_id = UUID(booking_id)
                # Approximate expiry based on fact it's in Redis
                
    return BaseResponse(success=True, data=[SeatResponse.model_validate(s) for s in seats])

@router.get("/{trip_id}/available-count", response_model=BaseResponse[Dict[str, int]])
async def get_available_count(trip_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SeatInventory).where(
        SeatInventory.trip_id == trip_id, 
        SeatInventory.status == SeatStatus.AVAILABLE
    ))
    seats = result.scalars().all()
    
    available = 0
    for seat in seats:
        booking_id = await RedisInventoryService.get_seat_lock(str(trip_id), seat.seat_number)
        if not booking_id:
            available += 1
            
    return BaseResponse(success=True, data={"available_seats": available})

@router.post("/{trip_id}/seats/lock", response_model=BaseResponse[LockResponse])
async def lock_seats(trip_id: UUID, req: LockRequest, db: AsyncSession = Depends(get_db)):
    # Check DB status first
    result = await db.execute(select(SeatInventory).where(
        SeatInventory.trip_id == trip_id,
        SeatInventory.seat_number.in_(req.seat_numbers)
    ))
    seats = result.scalars().all()
    
    if len(seats) != len(req.seat_numbers):
        raise HTTPException(status_code=400, detail="One or more seats not found")
        
    for seat in seats:
        if seat.status == SeatStatus.BOOKED:
            raise SeatAlreadyLocked(f"Seat {seat.seat_number} is already booked")
            
    # Try locking in Redis
    locked_seats = []
    for sn in req.seat_numbers:
        success = await RedisInventoryService.lock_seat(str(trip_id), sn, str(req.booking_id))
        if success:
            locked_seats.append(sn)
        else:
            # Rollback locks if failing midway
            for lsn in locked_seats:
                await RedisInventoryService.unlock_seat(str(trip_id), lsn)
            raise SeatAlreadyLocked(f"Seat {sn} is already locked")
            
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=RedisInventoryService.LOCK_TTL)
    
    # Optionally update DB status to LOCKED
    for seat in seats:
        seat.status = SeatStatus.LOCKED
        seat.locked_by_booking_id = req.booking_id
        seat.lock_expires_at = expires_at
    await db.commit()
    
    return BaseResponse(success=True, data=LockResponse(locked=locked_seats, expires_at=expires_at))

@router.post("/{trip_id}/seats/release", response_model=BaseResponse)
async def release_seats(trip_id: UUID, req: ReleaseRequest, db: AsyncSession = Depends(get_db)):
    query = select(SeatInventory).where(
        SeatInventory.trip_id == trip_id,
        SeatInventory.locked_by_booking_id == req.booking_id
    )
    if req.seat_numbers:
        query = query.where(SeatInventory.seat_number.in_(req.seat_numbers))
        
    result = await db.execute(query)
    seats = result.scalars().all()
    
    for seat in seats:
        if seat.status != SeatStatus.BOOKED:
            seat.status = SeatStatus.AVAILABLE
            seat.locked_by_booking_id = None
            seat.lock_expires_at = None
        await RedisInventoryService.unlock_seat(str(trip_id), seat.seat_number)
        
    await db.commit()
    return BaseResponse(success=True, message="Seats released")

@router.post("/{trip_id}/seats/confirm", response_model=BaseResponse)
async def confirm_seats(trip_id: UUID, req: ConfirmRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SeatInventory).where(
        SeatInventory.trip_id == trip_id,
        SeatInventory.seat_number.in_(req.seat_numbers),
        SeatInventory.locked_by_booking_id == req.booking_id
    ))
    seats = result.scalars().all()
    
    if len(seats) != len(req.seat_numbers):
        raise HTTPException(status_code=400, detail="Invalid seat confirmation request")
        
    for seat in seats:
        seat.status = SeatStatus.BOOKED
        seat.booked_by_user_id = req.user_id
        await RedisInventoryService.unlock_seat(str(trip_id), seat.seat_number)
        
    await db.commit()
    return BaseResponse(success=True, message="Seats confirmed")
