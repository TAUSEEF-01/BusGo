from sqlalchemy import Column, String, DateTime, Numeric, Enum, Integer, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum
from database import Base

class DiscountType(str, enum.Enum):
    PERCENTAGE = "PERCENTAGE"
    FLAT = "FLAT"

class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, index=True, nullable=False)
    discount_type = Column(Enum(DiscountType), nullable=False)
    discount_value = Column(Numeric(10, 2), nullable=False)
    min_fare = Column(Numeric(10, 2), default=0.0)
    max_discount = Column(Numeric(10, 2), nullable=True)
    valid_from = Column(DateTime, nullable=False)
    valid_until = Column(DateTime, nullable=False)
    max_uses = Column(Integer, nullable=False)
    current_uses = Column(Integer, default=0)
    applicable_operators = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)

class FlashSale(Base):
    __tablename__ = "flash_sales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    discount_percentage = Column(Integer, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    applicable_trips = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
