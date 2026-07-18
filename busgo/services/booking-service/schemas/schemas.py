from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date, time
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import BookingStatus

class PassengerDetail(BaseModel):
    name: str
    age: int
    gender: str
    seat: str

class BookingCreate(BaseModel):
    trip_id: UUID
    operator_id: UUID
    operator_name: Optional[str] = None
    seat_numbers: List[str]
    passenger_details: List[PassengerDetail]
    boarding_point: str
    dropping_point: str
    journey_date: date
    departure_time: time
    total_fare: float
    promo_code: Optional[str] = None
    idempotency_key: str

class BookingResponse(BaseModel):
    id: UUID
    user_id: UUID
    trip_id: UUID
    operator_id: UUID
    operator_name: Optional[str] = None
    status: BookingStatus
    total_fare: float
    discount_amount: float
    seat_numbers: List[str]
    passenger_details: Optional[List[Dict[str, Any]]] = None
    boarding_point: str
    dropping_point: str
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None
    arrival_datetime: Optional[datetime] = None
    bus_type: Optional[str] = None
    bus_registration_no: Optional[str] = None
    journey_date: date
    departure_time: time
    expires_at: datetime
    created_at: datetime
    journey_id: Optional[UUID] = None
    leg_number: Optional[int] = None

    class Config:
        from_attributes = True

class BookingStatusChange(BaseModel):
    status: BookingStatus
    reason: Optional[str] = None

class ApplyPromoRequest(BaseModel):
    promo_code: str

class JourneyLegCreate(BaseModel):
    trip_id: UUID
    operator_id: UUID
    seat_numbers: List[str]
    boarding_point: str
    dropping_point: str
    journey_date: date
    departure_time: time
    fare: float

class JourneyCreate(BaseModel):
    origin: str
    destination: str
    legs: List[JourneyLegCreate]
    passenger_details: List[PassengerDetail]
    total_fare: float
    promo_code: Optional[str] = None
    transit_route_id: Optional[UUID] = None
    idempotency_key: str
