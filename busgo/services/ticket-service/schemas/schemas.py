from pydantic import BaseModel
from typing import Optional, Dict, Any, List, Union
from uuid import UUID
from datetime import datetime

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import TicketStatus

class TicketResponse(BaseModel):
    id: UUID
    booking_id: UUID
    user_id: UUID
    trip_id: UUID
    seat_numbers: List[str]
    passenger_details: Union[List[Dict[str, Any]], Dict[str, Any]]
    qr_code_url: Optional[str]
    pdf_url: Optional[str]
    status: TicketStatus
    issued_at: datetime
    used_at: Optional[datetime]
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True

class ValidateQRRequest(BaseModel):
    qr_code_data: str

class ValidateQRResponse(BaseModel):
    valid: bool
    message: str
    passenger_details: Optional[Union[List[Dict[str, Any]], Dict[str, Any]]] = None
    seat_numbers: Optional[List[str]] = None
    trip_id: Optional[UUID] = None
