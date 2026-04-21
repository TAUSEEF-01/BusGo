from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from models import DiscountType


class PromoCodeBase(BaseModel):
    code: str
    discount_type: DiscountType
    discount_value: float
    min_fare: float = 0.0
    max_discount: Optional[float] = None
    valid_from: datetime
    valid_until: datetime
    max_uses: int
    applicable_operators: List[str] = []
    is_active: bool = True


class PromoCodeCreate(PromoCodeBase):
    pass


class PromoCodeUpdate(BaseModel):
    is_active: Optional[bool] = None
    valid_until: Optional[datetime] = None
    max_uses: Optional[int] = None


class PromoCodeResponse(PromoCodeBase):
    id: UUID
    current_uses: int

    class Config:
        orm_mode = True


class FlashSaleResponse(BaseModel):
    id: UUID
    name: str
    discount_percentage: int
    start_time: datetime
    end_time: datetime
    applicable_trips: List[str]
    is_active: bool

    class Config:
        orm_mode = True


class ValidatePromoRequest(BaseModel):
    code: str
    trip_id: UUID
    fare_amount: float
    user_id: UUID


class ValidatePromoResponse(BaseModel):
    valid: bool
    discount_amount: float = 0.0
    final_fare: float = 0.0
    message: Optional[str] = None


class ApplyPromoRequest(BaseModel):
    code: str
    user_id: UUID
