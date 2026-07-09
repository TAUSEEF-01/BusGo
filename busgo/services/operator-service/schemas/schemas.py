from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from models.models import BusType, TripStatus

class OperatorBase(BaseModel):
    name: str
    contact_phone: str
    contact_email: str
    address: str
    license_no: str
    commission_rate: Optional[float] = 10.0
    is_active: Optional[bool] = True

class OperatorCreate(OperatorBase):
    pass

class OperatorUpdate(BaseModel):
    name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    address: Optional[str] = None
    license_no: Optional[str] = None
    commission_rate: Optional[float] = None
    is_active: Optional[bool] = None

class OperatorResponse(OperatorBase):
    id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class Point(BaseModel):
    name: str
    address: str
    lat: float
    lng: float

class BusBase(BaseModel):
    registration_no: str
    bus_type: BusType
    total_seats: int
    seat_layout: Dict[str, Any]
    booked_seats: Optional[List[str]] = []
    amenities: List[str]
    is_active: Optional[bool] = True

class BusCreate(BusBase):
    pass

class BusUpdate(BaseModel):
    registration_no: Optional[str] = None
    bus_type: Optional[BusType] = None
    total_seats: Optional[int] = None
    seat_layout: Optional[Dict[str, Any]] = None
    booked_seats: Optional[List[str]] = None
    amenities: Optional[List[str]] = None
    is_active: Optional[bool] = None

class BusResponse(BusBase):
    id: UUID
    operator_id: UUID
    class Config:
        from_attributes = True

class RouteBase(BaseModel):
    origin_city: str
    destination_city: str
    distance_km: float
    estimated_duration_hours: float
    boarding_points: List[Point]
    dropping_points: List[Point]

class RouteCreate(RouteBase):
    pass

class RouteUpdate(BaseModel):
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None
    distance_km: Optional[float] = None
    estimated_duration_hours: Optional[float] = None
    boarding_points: Optional[List[Point]] = None
    dropping_points: Optional[List[Point]] = None

class RouteResponse(RouteBase):
    id: UUID
    operator_id: UUID
    class Config:
        from_attributes = True

class TripBase(BaseModel):
    bus_id: UUID
    route_id: UUID
    departure_datetime: datetime
    arrival_datetime: datetime
    fare_amount: float
    available_seats: int
    status: Optional[TripStatus] = TripStatus.SCHEDULED
    allow_transit: Optional[bool] = True

class TripCreate(TripBase):
    operator_id: UUID

class TripUpdate(BaseModel):
    departure_datetime: Optional[datetime] = None
    arrival_datetime: Optional[datetime] = None
    fare_amount: Optional[float] = None
    available_seats: Optional[int] = None
    status: Optional[TripStatus] = None
    allow_transit: Optional[bool] = None

class TripResponse(TripBase):
    id: UUID
    operator_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class TripEnrichedResponse(TripResponse):
    trip_id: str
    operator_name: str
    bus_type: str
    amenities: List[str]
    origin_city: str
    destination_city: str
    boarding_points: Optional[List[Point]] = None
    dropping_points: Optional[List[Point]] = None


class TransitRouteBase(BaseModel):
    name: str
    origin_city: str
    destination_city: str
    via_cities: List[str]
    combined_discount_pct: Optional[float] = 0.0
    is_active: Optional[bool] = True

class TransitRouteCreate(TransitRouteBase):
    operator_id: UUID

class TransitRouteUpdate(BaseModel):
    name: Optional[str] = None
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None
    via_cities: Optional[List[str]] = None
    combined_discount_pct: Optional[float] = None
    is_active: Optional[bool] = None

class TransitRouteResponse(TransitRouteBase):
    id: UUID
    operator_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True
