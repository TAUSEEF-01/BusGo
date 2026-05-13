from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from database import get_db
from schemas.cancellation import (
    CancellationCreate,
    OperatorCancellationCreate,
    CancellationResponse,
    CancellationDetail,
)
from services.cancellation_service import (
    process_cancellation,
    process_operator_cancellation,
    get_cancellation,
    get_cancellation_by_booking,
)

router = APIRouter(tags=["Cancellations"])


@router.post("/", response_model=CancellationResponse)
def create_cancellation(request: CancellationCreate, db: Session = Depends(get_db)):
    # Mock user extraction
    user_id = UUID("00000000-0000-0000-0000-000000000000")  # TODO: get from auth
    return process_cancellation(db, request, user_id)


@router.get("/{id}", response_model=CancellationDetail)
def read_cancellation(id: UUID, db: Session = Depends(get_db)):
    cancellation = get_cancellation(db, id)
    if not cancellation:
        raise HTTPException(status_code=404, detail="Cancellation not found")
    return cancellation


@router.get("/booking/{booking_id}", response_model=CancellationDetail)
def read_cancellation_by_booking(booking_id: UUID, db: Session = Depends(get_db)):
    cancellation = get_cancellation_by_booking(db, booking_id)
    if not cancellation:
        raise HTTPException(status_code=404, detail="Cancellation not found")
    return cancellation


@router.post("/operator-cancel")
def operator_cancel(request: OperatorCancellationCreate, db: Session = Depends(get_db)):
    # Mock admin verification
    affected = process_operator_cancellation(db, request)
    return {"affected_bookings": affected}
