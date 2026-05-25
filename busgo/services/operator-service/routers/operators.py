from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from database import get_db
from models.models import Operator
from schemas.schemas import OperatorCreate, OperatorUpdate, OperatorResponse
from api.deps import require_role, get_current_user_payload

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.enums import UserRole

router = APIRouter(prefix="/operators", tags=["operators"])

@router.post("/register", response_model=BaseResponse[OperatorResponse])
async def register(req: OperatorCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(require_role(UserRole.ADMIN))):
    operator = Operator(**req.model_dump())
    db.add(operator)
    await db.commit()
    await db.refresh(operator)
    return BaseResponse(success=True, data=OperatorResponse.model_validate(operator), message="Operator registered")

@router.get("/{id}", response_model=BaseResponse[OperatorResponse])
async def get_operator(id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Operator).where(Operator.id == id))
    operator = result.scalars().first()
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    return BaseResponse(success=True, data=OperatorResponse.model_validate(operator))

@router.get("/", response_model=BaseResponse[List[OperatorResponse]])
async def list_operators(skip: int = Query(0, ge=0), limit: int = Query(20, gt=0), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Operator).offset(skip).limit(limit))
    operators = result.scalars().all()
    return BaseResponse(success=True, data=[OperatorResponse.model_validate(op) for op in operators])

@router.put("/{id}", response_model=BaseResponse[OperatorResponse])
async def update_operator(id: UUID, req: OperatorUpdate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    # Allow ADMIN, or OPERATOR if updating their own record
    user_role = payload.get("role", "").upper()
    user_id = payload.get("user_id")
    print(f"DEBUG update_operator: id={id} (type={type(id)}), user_role={user_role}, user_id={user_id} (type={type(user_id)}), matches={str(id).lower() == str(user_id).lower()}")
    
    if user_role == "ADMIN":
        pass
    elif user_role == "OPERATOR" and str(id).lower() == str(user_id).lower():
        pass
    else:
        raise HTTPException(status_code=403, detail="Operation not permitted")

    result = await db.execute(select(Operator).where(Operator.id == id))
    operator = result.scalars().first()
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(operator, key, value)
        
    await db.commit()
    await db.refresh(operator)
    return BaseResponse(success=True, data=OperatorResponse.model_validate(operator), message="Operator updated")
