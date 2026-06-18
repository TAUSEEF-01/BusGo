import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .base import Base

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import AccountType


class BankAccount(Base):
    __tablename__ = "bank_accounts"
    __table_args__ = (
        UniqueConstraint("user_id", "account_type", name="uq_user_account_type"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    account_type = Column(Enum(AccountType, name="bank_account_type"), nullable=False)
    # Display label for the provider, e.g. "BusGo Bank" or "bKash"
    provider = Column(String, nullable=False)
    account_number = Column(String, unique=True, index=True, nullable=False)
    pin = Column(String, nullable=True, default="1234")
    balance = Column(Numeric(12, 2), nullable=False, default=0)
    currency = Column(String, nullable=False, default="BDT")

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    transactions = relationship("BankTransaction", back_populates="account")


class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id"), nullable=False)
    # DEBIT (payment), CREDIT (admin top-up / refund)
    direction = Column(String, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    balance_after = Column(Numeric(12, 2), nullable=False)
    reference = Column(String, nullable=True)  # e.g. booking_id
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    account = relationship("BankAccount", back_populates="transactions")
