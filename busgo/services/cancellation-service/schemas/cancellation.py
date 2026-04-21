from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from models.cancellation import CancellationStatus


class CancellationCreate(BaseModel):
    booking_id: UUID
    reason: str


class OperatorCancellationCreate(BaseModel):
    trip_id: UUID
    reason: str


class CancellationResponse(BaseModel):
    cancellation_id: UUID
    refund_amount: Optional[float]
    estimated_days: int = 5

    class Config:
        orm_mode = True


class CancellationDetail(BaseModel):
    id: UUID
    booking_id: UUID
    user_id: UUID
    reason: str
    requested_at: datetime
    status: CancellationStatus
    rejection_reason: Optional[str]
    refund_amount: Optional[float]
    processed_at: Optional[datetime]

    class Config:
        orm_mode = True
