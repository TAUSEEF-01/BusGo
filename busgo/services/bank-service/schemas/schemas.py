from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import AccountType


class AccountResponse(BaseModel):
    id: UUID
    user_id: UUID
    account_type: AccountType
    provider: str
    account_number: str
    balance: Decimal
    currency: str

    class Config:
        from_attributes = True


class VerifyDebitRequest(BaseModel):
    user_id: UUID
    amount: Decimal
    method: str  # PaymentMethod value, e.g. BKASH / NAGAD / CARD / INTERNET_BANKING
    reference: Optional[str] = None  # booking_id


class VerifyDebitResponse(BaseModel):
    success: bool
    account_id: Optional[UUID] = None
    account_number: Optional[str] = None
    balance: Optional[Decimal] = None
    message: str


class CreditRequest(BaseModel):
    user_id: UUID
    amount: Decimal
    method: str  # PaymentMethod value — determines which account to credit
    reference: Optional[str] = None
    description: Optional[str] = "Refund"


class SetBalanceRequest(BaseModel):
    balance: Decimal


class TransactionResponse(BaseModel):
    id: UUID
    account_id: UUID
    direction: str
    amount: Decimal
    balance_after: Decimal
    reference: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminAccountResponse(AccountResponse):
    created_at: datetime
