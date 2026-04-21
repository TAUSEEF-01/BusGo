from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from models.models import SeatStatus, SeatType

class SeatResponse(BaseModel):
    id: UUID
    trip_id: UUID
    seat_number: str
    seat_type: SeatType
    status: SeatStatus
    locked_by_booking_id: Optional[UUID]
    lock_expires_at: Optional[datetime]
    booked_by_user_id: Optional[UUID]

    class Config:
        from_attributes = True

class LockRequest(BaseModel):
    seat_numbers: List[str]
    booking_id: UUID
    user_id: UUID

class LockResponse(BaseModel):
    locked: List[str]
    expires_at: datetime
    
class ReleaseRequest(BaseModel):
    seat_numbers: Optional[List[str]] = None
    booking_id: UUID
    
class ConfirmRequest(BaseModel):
    seat_numbers: List[str]
    booking_id: UUID
    user_id: UUID

class InitializeRequest(BaseModel):
    seat_layout: List[Dict[str, Any]] # e.g. [{"number": "A1", "type": "WINDOW"}, ...]
