import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Numeric, Date, Time, JSON, UniqueConstraint, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from .base import Base

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import BookingStatus

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    trip_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    operator_id = Column(UUID(as_uuid=True), nullable=False)
    
    seat_numbers = Column(JSONB, nullable=False)
    passenger_details = Column(JSONB, nullable=False)
    
    boarding_point = Column(String, nullable=False)
    dropping_point = Column(String, nullable=False)
    journey_date = Column(Date, nullable=False)
    departure_time = Column(Time, nullable=False)
    
    total_fare = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), default=0.0)
    promo_code = Column(String, nullable=True)

    # Set when this booking is one leg of a multi-leg transit journey.
    journey_id = Column(UUID(as_uuid=True), index=True, nullable=True)
    leg_number = Column(Integer, nullable=True)  # 1-based order within the journey

    status = Column(Enum(BookingStatus, name="booking_status"), default=BookingStatus.INITIATED)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    payment_id = Column(UUID(as_uuid=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)

    history = relationship("BookingStatusHistory", back_populates="booking", cascade="all, delete")

class TravelRecord(Base):
    """A simple per-user travel record — one row per confirmed journey.

    This is the lightweight "model" that tracks where each user travels. It is
    populated whenever a booking is confirmed and is the data the re-marketing
    algorithm reads to find users likely to be interested in an under-filled
    trip. Unique on (user_id, trip_id) so re-processing a booking is idempotent.
    """
    __tablename__ = "travel_records"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    trip_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    operator_id = Column(UUID(as_uuid=True), index=True, nullable=True)
    origin = Column(String, index=True, nullable=False)
    destination = Column(String, index=True, nullable=False)
    journey_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("user_id", "trip_id", name="uq_travel_user_trip"),)


class Journey(Base):
    """A multi-leg transit journey. Each leg is a normal Booking row carrying
    this journey's id and its leg_number. The journey holds the combined fare,
    any journey-level discount (operator transit route and/or promo), and the
    overall status; the legs mirror the journey's lifecycle."""
    __tablename__ = "journeys"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    leg_count = Column(Integer, nullable=False)
    total_fare = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), default=0.0)
    promo_code = Column(String, nullable=True)
    status = Column(Enum(BookingStatus, name="booking_status"), default=BookingStatus.SEAT_LOCKED)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    payment_id = Column(UUID(as_uuid=True), nullable=True)
    transit_route_id = Column(UUID(as_uuid=True), nullable=True)  # operator-curated route, if any
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)


class BookingStatusHistory(Base):
    __tablename__ = "booking_status_history"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False)
    from_status = Column(Enum(BookingStatus, name="booking_status"), nullable=True)
    to_status = Column(Enum(BookingStatus, name="booking_status"), nullable=False)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    reason = Column(String, nullable=True)

    booking = relationship("Booking", back_populates="history")
