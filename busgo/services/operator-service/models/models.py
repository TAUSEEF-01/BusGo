import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, Float, Integer, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum
from .base import Base

class BusType(str, enum.Enum):
    AC = 'AC'
    NON_AC = 'NON_AC'
    SLEEPER = 'SLEEPER'

class TripStatus(str, enum.Enum):
    SCHEDULED = 'SCHEDULED'
    CANCELLED = 'CANCELLED'
    COMPLETED = 'COMPLETED'

class Operator(Base):
    __tablename__ = "operators"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    contact_phone = Column(String, nullable=False)
    contact_email = Column(String, nullable=False)
    address = Column(String, nullable=False)
    license_no = Column(String, nullable=False)
    commission_rate = Column(Float, default=10.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    buses = relationship("Bus", back_populates="operator")
    routes = relationship("Route", back_populates="operator")
    trips = relationship("Trip", back_populates="operator")

class Bus(Base):
    __tablename__ = "buses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id"), nullable=False)
    registration_no = Column(String, unique=True, index=True, nullable=False)
    bus_type = Column(Enum(BusType), nullable=False)
    total_seats = Column(Integer, nullable=False)
    seat_layout = Column(JSONB, nullable=False)
    amenities = Column(JSONB, nullable=False)
    is_active = Column(Boolean, default=True)
    
    operator = relationship("Operator", back_populates="buses")
    trips = relationship("Trip", back_populates="bus")

class Route(Base):
    __tablename__ = "routes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id"), nullable=False)
    origin_city = Column(String, index=True, nullable=False)
    destination_city = Column(String, index=True, nullable=False)
    distance_km = Column(Float, nullable=False)
    estimated_duration_hours = Column(Float, nullable=False)
    boarding_points = Column(JSONB, nullable=False)
    dropping_points = Column(JSONB, nullable=False)

    operator = relationship("Operator", back_populates="routes")
    trips = relationship("Trip", back_populates="route")

class Trip(Base):
    __tablename__ = "trips"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id"), nullable=False)
    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id"), nullable=False)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=False)
    departure_datetime = Column(DateTime(timezone=True), nullable=False)
    arrival_datetime = Column(DateTime(timezone=True), nullable=False)
    fare_amount = Column(Numeric(10, 2), nullable=False)
    available_seats = Column(Integer, nullable=False)
    status = Column(Enum(TripStatus), default=TripStatus.SCHEDULED)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    operator = relationship("Operator", back_populates="trips")
    bus = relationship("Bus", back_populates="trips")
    route = relationship("Route", back_populates="trips")
