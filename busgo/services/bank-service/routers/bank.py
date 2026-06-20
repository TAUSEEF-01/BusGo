from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timezone

from database import get_db
from models.models import BankAccount, BankTransaction
from schemas.schemas import (
    AccountResponse, VerifyDebitRequest, VerifyDebitResponse,
    CreditRequest, SetBalanceRequest, AdminAccountResponse, TransactionResponse,
)
from api.deps import get_current_user_payload
from services.provisioning import provision_accounts, METHOD_TO_ACCOUNT_TYPE

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.enums import AccountType

router = APIRouter(tags=["bank"])


@router.get("/accounts/my", response_model=BaseResponse[List[AccountResponse]])
async def my_accounts(db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("user_id")
    if not user_id or user_id == "system":
        raise HTTPException(status_code=401, detail="Unauthorized")
    phone = payload.get("phone")
    # Self-heal: ensure accounts exist even for users registered before bank-service.
    accounts = await provision_accounts(db, user_id, phone)
    return BaseResponse(success=True, data=[AccountResponse.model_validate(a) for a in accounts])


@router.post("/provision", response_model=BaseResponse[List[AccountResponse]])
async def provision(db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("user_id")
    if not user_id or user_id == "system":
        raise HTTPException(status_code=401, detail="Unauthorized")
    accounts = await provision_accounts(db, user_id, payload.get("phone"))
    return BaseResponse(success=True, data=[AccountResponse.model_validate(a) for a in accounts])


@router.post("/verify-debit", response_model=BaseResponse[VerifyDebitResponse])
async def verify_debit(req: VerifyDebitRequest, db: AsyncSession = Depends(get_db)):
    """Internal endpoint used by payment-service. Verifies the user has enough
    balance in the account that funds the chosen method, then debits it."""
    acct_type = METHOD_TO_ACCOUNT_TYPE.get(req.method.upper())
    if acct_type is None:
        raise HTTPException(status_code=400, detail=f"Unknown payment method: {req.method}")

    # Make sure accounts exist for this user.
    await provision_accounts(db, str(req.user_id))

    res = await db.execute(
        select(BankAccount).where(
            BankAccount.user_id == req.user_id,
            BankAccount.account_type == acct_type,
        )
    )
    account = res.scalars().first()
    if not account:
        return BaseResponse(success=False, data=VerifyDebitResponse(
            success=False, message="No funding account found for this method"
        ))

    # Validate credentials for mobile wallet payments.
    if acct_type == AccountType.MOBILE:
        if not req.mobile_number:
            return BaseResponse(success=False, data=VerifyDebitResponse(
                success=False, message="Mobile number is required for this payment method"
            ))
        entered = "".join(c for c in req.mobile_number if c.isdigit())
        stored = "".join(c for c in (account.account_number or "") if c.isdigit())
        if entered[-11:] != stored[-11:]:
            return BaseResponse(success=False, data=VerifyDebitResponse(
                success=False, message="Mobile number does not match the registered account"
            ))
        if not req.pin:
            return BaseResponse(success=False, data=VerifyDebitResponse(
                success=False, message="PIN is required for this payment method"
            ))
        if req.pin != (account.pin or "1234"):
            return BaseResponse(success=False, data=VerifyDebitResponse(
                success=False, message="Incorrect PIN"
            ))

    amount = Decimal(req.amount)
    if account.balance < amount:
        return BaseResponse(success=False, data=VerifyDebitResponse(
            success=False,
            account_id=account.id,
            account_number=account.account_number,
            balance=account.balance,
            message=f"Insufficient balance. Available ৳{account.balance}, required ৳{amount}",
        ))

    account.balance = account.balance - amount
    db.add(BankTransaction(
        account_id=account.id,
        direction="DEBIT",
        amount=amount,
        balance_after=account.balance,
        reference=req.reference,
        description="Bus ticket payment",
    ))
    await db.commit()
    await db.refresh(account)

    return BaseResponse(success=True, data=VerifyDebitResponse(
        success=True,
        account_id=account.id,
        account_number=account.account_number,
        balance=account.balance,
        message="Payment debited successfully",
    ))


@router.post("/credit", response_model=BaseResponse[VerifyDebitResponse])
async def credit_account(req: CreditRequest, db: AsyncSession = Depends(get_db)):
    """Internal endpoint used by booking-service on cancellation refund."""
    acct_type = METHOD_TO_ACCOUNT_TYPE.get(req.method.upper())
    if acct_type is None:
        raise HTTPException(status_code=400, detail=f"Unknown payment method: {req.method}")

    await provision_accounts(db, str(req.user_id))

    res = await db.execute(
        select(BankAccount).where(
            BankAccount.user_id == req.user_id,
            BankAccount.account_type == acct_type,
        )
    )
    account = res.scalars().first()
    if not account:
        raise HTTPException(status_code=404, detail="No account found for this method")

    amount = Decimal(req.amount)
    account.balance = account.balance + amount
    db.add(BankTransaction(
        account_id=account.id,
        direction="CREDIT",
        amount=amount,
        balance_after=account.balance,
        reference=req.reference,
        description=req.description or "Refund",
    ))
    await db.commit()
    await db.refresh(account)

    return BaseResponse(success=True, data=VerifyDebitResponse(
        success=True,
        account_id=account.id,
        account_number=account.account_number,
        balance=account.balance,
        message=f"Refund of ৳{amount} credited successfully",
    ))


@router.get("/transactions/my", response_model=BaseResponse[List[TransactionResponse]])
async def my_transactions(db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("user_id")
    if not user_id or user_id == "system":
        raise HTTPException(status_code=401, detail="Unauthorized")
    res = await db.execute(
        select(BankTransaction)
        .join(BankAccount, BankTransaction.account_id == BankAccount.id)
        .where(BankAccount.user_id == user_id)
        .order_by(BankTransaction.created_at.desc())
    )
    txns = res.scalars().all()
    return BaseResponse(success=True, data=[TransactionResponse.model_validate(t) for t in txns])


# ── Admin (Bank section) ──────────────────────────────────────────────
@router.get("/admin/accounts", response_model=BaseResponse[List[AdminAccountResponse]])
async def admin_list_accounts(
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(BankAccount).order_by(BankAccount.created_at.desc())
    if search:
        like = f"%{search}%"
        query = query.where(BankAccount.account_number.ilike(like))
    res = await db.execute(query)
    accounts = res.scalars().all()
    return BaseResponse(success=True, data=[AdminAccountResponse.model_validate(a) for a in accounts])


@router.get("/admin/accounts/by-user/{user_id}", response_model=BaseResponse[List[AdminAccountResponse]])
async def admin_accounts_by_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BankAccount).where(BankAccount.user_id == user_id))
    accounts = res.scalars().all()
    return BaseResponse(success=True, data=[AdminAccountResponse.model_validate(a) for a in accounts])


@router.post("/admin/accounts/{account_id}/set-balance", response_model=BaseResponse[AdminAccountResponse])
async def admin_set_balance(account_id: UUID, req: SetBalanceRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BankAccount).where(BankAccount.id == account_id))
    account = res.scalars().first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    new_balance = Decimal(req.balance)
    delta = new_balance - account.balance
    account.balance = new_balance
    db.add(BankTransaction(
        account_id=account.id,
        direction="CREDIT" if delta >= 0 else "DEBIT",
        amount=abs(delta),
        balance_after=new_balance,
        reference="admin-adjustment",
        description="Admin balance adjustment",
    ))
    await db.commit()
    await db.refresh(account)
    return BaseResponse(success=True, data=AdminAccountResponse.model_validate(account))
