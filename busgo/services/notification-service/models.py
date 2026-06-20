from sqlalchemy import Column, String, DateTime, JSON, Enum, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum
from database import Base
from notification_types import NotificationType


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
    channel = Column(Enum(NotificationChannel, name="notification_channel"), nullable=False)
    template_name = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    status = Column(Enum(NotificationStatus, name="notification_status"), default=NotificationStatus.PENDING)
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)


# ---------------------------------------------------------------------------
# In-App Notification — persisted per user, fetched by the frontend
# ---------------------------------------------------------------------------

class InAppNotification(Base):
    """
    Stores in-app notifications visible in the notification bell / page.
    Separate from NotificationLog (which tracks delivery status of
    SMS / Email / Push / WhatsApp outbound messages).
    """
    __tablename__ = "in_app_notifications"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), nullable=False, index=True)
    role         = Column(String, nullable=False)          # CUSTOMER | OPERATOR | ADMIN
    type         = Column(
                       Enum(NotificationType, name="in_app_notification_type"),
                       nullable=False
                   )
    title        = Column(String, nullable=False)
    message      = Column(Text, nullable=False)
    meta_data    = Column("metadata", JSON, nullable=True, default=dict)  # arbitrary extra data
    is_read      = Column(Boolean, default=False, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    read_at      = Column(DateTime, nullable=True)
