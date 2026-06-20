from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from models.models import PaymentStatus, RefundStatus
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import PaymentMethod

class InitiateRequest(BaseModel):
    booking_id: UUID
    trip_id: UUID
    amount: float
    method: PaymentMethod
    mobile_number: Optional[str] = None  # required for BKASH / NAGAD
    pin: Optional[str] = None  # required for BKASH / NAGAD

class InitiateResponse(BaseModel):
    payment_id: UUID
    redirect_url: str

class CallbackRequest(BaseModel):
    gateway_transaction_id: str
    status: str
    response_data: Dict[str, Any]

class PaymentResponse(BaseModel):
    id: UUID
    booking_id: UUID
    user_id: UUID
    trip_id: UUID
    amount: float
    method: PaymentMethod
    gateway_transaction_id: Optional[str]
    status: PaymentStatus
    initiated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True

class RefundRequest(BaseModel):
    reason: str

class RefundResponse(BaseModel):
    id: UUID
    payment_id: UUID
    booking_id: UUID
    amount: float
    reason: str
    status: RefundStatus
    estimated_days: int
    initiated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True
