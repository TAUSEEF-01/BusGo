import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import Column, String, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from .base import Base

class SeatType(str, enum.Enum):
    WINDOW = 'WINDOW'
    AISLE = 'AISLE'
    SLEEPER_UPPER = 'SLEEPER_UPPER'
    SLEEPER_LOWER = 'SLEEPER_LOWER'

class SeatStatus(str, enum.Enum):
    AVAILABLE = 'AVAILABLE'
    LOCKED = 'LOCKED'
    BOOKED = 'BOOKED'

class SeatInventory(Base):
    __tablename__ = "seat_inventory"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    seat_number = Column(String, nullable=False)
    seat_type = Column(Enum(SeatType, name="seat_type"), nullable=False)
    status = Column(Enum(SeatStatus, name="seat_status"), default=SeatStatus.AVAILABLE)
    locked_by_booking_id = Column(UUID(as_uuid=True), nullable=True)
    lock_expires_at = Column(DateTime(timezone=True), nullable=True)
    booked_by_user_id = Column(UUID(as_uuid=True), nullable=True)
