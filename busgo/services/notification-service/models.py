from sqlalchemy import Column, String, DateTime, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum
from database import Base

class NotificationChannel(str, enum.Enum):
    SMS = "SMS"
    EMAIL = "EMAIL"
    PUSH = "PUSH"
    WHATSAPP = "WHATSAPP"

class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"

class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    channel = Column(Enum(NotificationChannel), nullable=False)
    template_name = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    status = Column(Enum(NotificationStatus), default=NotificationStatus.PENDING)
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)
