from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
from datetime import datetime, timezone

from database import get_db
from models.models import Ticket
from schemas.schemas import TicketResponse, ValidateQRRequest, ValidateQRResponse
from api.deps import get_current_user_payload, require_role

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.enums import TicketStatus, UserRole
from shared.kafka_producer import KafkaProducerClient

router = APIRouter(tags=["tickets"])

@router.get("/my", response_model=BaseResponse[List[TicketResponse]])
async def get_my_tickets(db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("user_id")
    result = await db.execute(select(Ticket).where(Ticket.user_id == user_id))
    tickets = result.scalars().all()
    return BaseResponse(success=True, data=[TicketResponse.model_validate(t) for t in tickets])

@router.get("/{ticket_id}", response_model=BaseResponse[TicketResponse])
async def get_ticket(ticket_id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if str(ticket.user_id) != payload.get("user_id") and payload.get("role") not in [UserRole.ADMIN.value, UserRole.OPERATOR.value]:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    return BaseResponse(success=True, data=TicketResponse.model_validate(ticket))

@router.get("/booking/{booking_id}", response_model=BaseResponse[TicketResponse])
async def get_ticket_by_booking(booking_id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    result = await db.execute(select(Ticket).where(Ticket.booking_id == booking_id))
    ticket = result.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if str(ticket.user_id) != payload.get("user_id") and payload.get("role") not in [UserRole.ADMIN.value, UserRole.OPERATOR.value]:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    return BaseResponse(success=True, data=TicketResponse.model_validate(ticket))

# Boarding validation
@router.post("/validate-qr", response_model=BaseResponse[ValidateQRResponse])
async def validate_qr(req: ValidateQRRequest, db: AsyncSession = Depends(get_db), payload: dict = Depends(require_role([UserRole.OPERATOR.value, UserRole.ADMIN.value]))):
    # Only operators/admins can validate at boarding
    
    result = await db.execute(select(Ticket).where(Ticket.qr_code_data == req.qr_code_data))
    ticket = result.scalars().first()
    
    if not ticket:
        return BaseResponse(success=False, data=ValidateQRResponse(valid=False, message="Invalid QR code"))
        
    if ticket.status == TicketStatus.USED:
        return BaseResponse(success=False, data=ValidateQRResponse(
            valid=False, message="Ticket already used",
            passenger_details=ticket.passenger_details,
            seat_numbers=ticket.seat_numbers,
            trip_id=ticket.trip_id
        ))
        
    if ticket.status == TicketStatus.CANCELLED:
        return BaseResponse(success=False, data=ValidateQRResponse(valid=False, message="Ticket is cancelled"))
        
    # Check expiry (simplified: just check if expires_at is set and past)
    if ticket.expires_at and datetime.now(timezone.utc) > ticket.expires_at:
        ticket.status = TicketStatus.EXPIRED
        await db.commit()
        return BaseResponse(success=False, data=ValidateQRResponse(valid=False, message="Ticket is expired"))
        
    # Valid - mark as used
    ticket.status = TicketStatus.USED
    ticket.used_at = datetime.now(timezone.utc)
    await db.commit()
    
    await KafkaProducerClient.publish("audit.log", {
        "event": "ticket.used", 
        "ticket_id": str(ticket.id),
        "trip_id": str(ticket.trip_id),
        "operator_id": payload.get("user_id")
    })
    
    return BaseResponse(success=True, data=ValidateQRResponse(
        valid=True, 
        message="Ticket valid and marked as used",
        passenger_details=ticket.passenger_details,
        seat_numbers=ticket.seat_numbers,
        trip_id=ticket.trip_id
    ))
