import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from .base import Base

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import PaymentMethod

class PaymentStatus(str, enum.Enum):
    PENDING = 'PENDING'
    COMPLETED = 'COMPLETED'
    FAILED = 'FAILED'
    REFUNDED = 'REFUNDED'

class RefundStatus(str, enum.Enum):
    PENDING = 'PENDING'
    PROCESSING = 'PROCESSING'
    COMPLETED = 'COMPLETED'
    FAILED = 'FAILED'

class Payment(Base):
    __tablename__ = "payments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    trip_id = Column(UUID(as_uuid=True), index=True, nullable=False) # added for fraud detection
    
    amount = Column(Numeric(10, 2), nullable=False)
    method = Column(Enum(PaymentMethod), nullable=False)
    gateway_transaction_id = Column(String, nullable=True, unique=True)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    gateway_response = Column(JSONB, nullable=True)
    
    initiated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    refunds = relationship("Refund", back_populates="payment")

class Refund(Base):
    __tablename__ = "refunds"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=False)
    booking_id = Column(UUID(as_uuid=True), nullable=False)
    
    amount = Column(Numeric(10, 2), nullable=False)
    reason = Column(String, nullable=False)
    status = Column(Enum(RefundStatus), default=RefundStatus.PENDING)
    gateway_refund_id = Column(String, nullable=True)
    
    initiated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    estimated_days = Column(Integer, nullable=False)

    payment = relationship("Payment", back_populates="refunds")
