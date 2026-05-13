import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Numeric, Date, Time, JSON
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
    operator_name = Column(String, nullable=True)
    
    seat_numbers = Column(JSONB, nullable=False)
    passenger_details = Column(JSONB, nullable=False)
    
    boarding_point = Column(String, nullable=False)
    dropping_point = Column(String, nullable=False)
    journey_date = Column(Date, nullable=False)
    departure_time = Column(Time, nullable=False)
    
    total_fare = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), default=0.0)
    promo_code = Column(String, nullable=True)
    
    status = Column(Enum(BookingStatus), default=BookingStatus.INITIATED)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    payment_id = Column(UUID(as_uuid=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)

    history = relationship("BookingStatusHistory", back_populates="booking", cascade="all, delete")

class BookingStatusHistory(Base):
    __tablename__ = "booking_status_history"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False)
    from_status = Column(Enum(BookingStatus), nullable=True)
    to_status = Column(Enum(BookingStatus), nullable=False)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    reason = Column(String, nullable=True)

    booking = relationship("Booking", back_populates="history")
