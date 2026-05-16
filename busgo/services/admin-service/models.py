from sqlalchemy import Column, String, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum
from database import Base


class TicketStatus(str, enum.Enum):
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    subject = Column(String, nullable=False)
    message = Column(String, nullable=False)
    status = Column(Enum(TicketStatus, name="ticket_status"), default=TicketStatus.OPEN)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
