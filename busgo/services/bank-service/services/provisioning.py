import random
import sys
import os
from decimal import Decimal
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.models import BankAccount

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import AccountType, PaymentMethod

# Map a payment method to the account type that funds it.
METHOD_TO_ACCOUNT_TYPE = {
    PaymentMethod.BKASH.value: AccountType.MOBILE,
    PaymentMethod.NAGAD.value: AccountType.MOBILE,
    PaymentMethod.CARD.value: AccountType.BANK,
    PaymentMethod.INTERNET_BANKING.value: AccountType.BANK,
}


def _random_balance() -> Decimal:
    # Random starting balance between 1,000 and 20,000 BDT, rounded to 50.
    return Decimal(random.randrange(1000, 20001, 50))


def _bank_account_number() -> str:
    return "BNK" + "".join(str(random.randint(0, 9)) for _ in range(12))


def _mobile_account_number(phone: str | None) -> str:
    digits = "".join(c for c in (phone or "") if c.isdigit())
    if len(digits) >= 11:
        return digits[-11:]
    # Generate a plausible BD mobile number if none provided.
    return "01" + "".join(str(random.randint(0, 9)) for _ in range(9))


async def provision_accounts(db: AsyncSession, user_id: str, phone: str | None = None) -> list[BankAccount]:
    """Idempotently ensure the user has one BANK and one MOBILE account.
    Returns the full list of the user's accounts."""
    existing_res = await db.execute(select(BankAccount).where(BankAccount.user_id == user_id))
    existing = existing_res.scalars().all()
    existing_types = {a.account_type for a in existing}

    created = False
    if AccountType.BANK not in existing_types:
        db.add(BankAccount(
            user_id=user_id,
            account_type=AccountType.BANK,
            provider="BusGo Bank",
            account_number=_bank_account_number(),
            balance=_random_balance(),
        ))
        created = True
    if AccountType.MOBILE not in existing_types:
        db.add(BankAccount(
            user_id=user_id,
            account_type=AccountType.MOBILE,
            provider="bKash",
            account_number=_mobile_account_number(phone),
            balance=_random_balance(),
        ))
        created = True

    if created:
        await db.commit()

    res = await db.execute(select(BankAccount).where(BankAccount.user_id == user_id))
    return res.scalars().all()
