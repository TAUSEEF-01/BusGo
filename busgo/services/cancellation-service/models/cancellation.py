from sqlalchemy import Column, String, DateTime, Numeric, Enum
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum
from database import Base


class CancellationStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class CancellationRequest(Base):
    __tablename__ = "cancellation_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    reason = Column(String, nullable=False)
    requested_at = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(CancellationStatus, name="cancellation_status"), default=CancellationStatus.PENDING)
    rejection_reason = Column(String, nullable=True)
    refund_amount = Column(Numeric(10, 2), nullable=True)
    processed_at = Column(DateTime, nullable=True)
