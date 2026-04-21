import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Enum, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .base import Base

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import TicketStatus

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), unique=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    trip_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    
    seat_numbers = Column(JSONB, nullable=False)
    passenger_details = Column(JSONB, nullable=False)
    
    qr_code_data = Column(String, unique=True, nullable=False)
    qr_code_url = Column(String, nullable=True)
    pdf_url = Column(String, nullable=True)
    
    status = Column(Enum(TicketStatus), default=TicketStatus.ACTIVE)
    
    issued_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index('ix_tickets_qr_data', 'qr_code_data'),
    )
