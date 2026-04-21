from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime
from uuid import UUID

class Point(BaseModel):
    name: str # e.g., location name

class TripDocument(BaseModel):
    trip_id: str
    operator_id: str
    operator_name: str
    bus_type: str
    origin_city: str
    destination_city: str
    departure_datetime: str
    arrival_datetime: str
    fare_amount: float
    available_seats: int
    boarding_points: List[Point] = []
    amenities: List[str] = []
    status: str

class SearchResult(BaseModel):
    trip_id: str
    operator_name: str
    bus_type: str
    origin_city: str
    destination_city: str
    departure_datetime: str
    arrival_datetime: str
    fare_amount: float
    available_seats: int
    matched_amenities: List[str] = []
