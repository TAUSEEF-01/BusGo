import uuid
import sys
import os
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .base import Base

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import UserRole

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, nullable=True)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole, name="user_role"), default=UserRole.CUSTOMER)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class OTPRecord(Base):
    __tablename__ = "otp_records"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String, index=True, nullable=False)
    otp_code = Column(String(6), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)
    
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False)
    user = relationship("User")
