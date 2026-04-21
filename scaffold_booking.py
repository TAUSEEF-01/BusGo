import os

base_dir = "busgo/services/booking-service"
os.makedirs(f"{base_dir}/core", exist_ok=True)
os.makedirs(f"{base_dir}/api", exist_ok=True)
os.makedirs(f"{base_dir}/models", exist_ok=True)
os.makedirs(f"{base_dir}/schemas", exist_ok=True)
os.makedirs(f"{base_dir}/services", exist_ok=True)
os.makedirs(f"{base_dir}/routers", exist_ok=True)

with open(f"{base_dir}/requirements.txt", "a") as f:
    f.write("redis\naiokafka\nhttpx\napscheduler\npython-jose[cryptography]\n")

with open(f"{base_dir}/core/config.py", "w") as f:
    f.write('''import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey-please-change-in-production")
    ALGORITHM: str = "HS256"
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/3")
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    INVENTORY_SERVICE_URL: str = os.getenv("INVENTORY_SERVICE_URL", "http://inventory-service:8000")
    DEALS_SERVICE_URL: str = os.getenv("DEALS_SERVICE_URL", "http://deals-service:8000")

settings = Settings()
''')

with open(f"{base_dir}/models/base.py", "w") as f:
    f.write('''from sqlalchemy.orm import declarative_base
Base = declarative_base()
''')

with open(f"{base_dir}/models/models.py", "w") as f:
    f.write('''import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Numeric, Date, Time, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from .base import Base

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import BookingStatus

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    trip_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    operator_id = Column(UUID(as_uuid=True), nullable=False)
    
    seat_numbers = Column(JSONB, nullable=False)
    passenger_details = Column(JSONB, nullable=False)
    
    boarding_point = Column(String, nullable=False)
    dropping_point = Column(String, nullable=False)
    journey_date = Column(Date, nullable=False)
    departure_time = Column(Time, nullable=False)
    
    total_fare = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), default=0.0)
    promo_code = Column(String, nullable=True)
    
    status = Column(Enum(BookingStatus), default=BookingStatus.INITIATED)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    payment_id = Column(UUID(as_uuid=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)

    history = relationship("BookingStatusHistory", back_populates="booking", cascade="all, delete")

class BookingStatusHistory(Base):
    __tablename__ = "booking_status_history"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False)
    from_status = Column(Enum(BookingStatus), nullable=True)
    to_status = Column(Enum(BookingStatus), nullable=False)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    reason = Column(String, nullable=True)

    booking = relationship("Booking", back_populates="history")
''')

with open(f"{base_dir}/schemas/schemas.py", "w") as f:
    f.write('''from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date, time
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import BookingStatus

class PassengerDetail(BaseModel):
    name: str
    age: int
    gender: str
    seat: str

class BookingCreate(BaseModel):
    trip_id: UUID
    operator_id: UUID
    seat_numbers: List[str]
    passenger_details: List[PassengerDetail]
    boarding_point: str
    dropping_point: str
    journey_date: date
    departure_time: time
    total_fare: float
    promo_code: Optional[str] = None
    idempotency_key: str

class BookingResponse(BaseModel):
    id: UUID
    user_id: UUID
    trip_id: UUID
    status: BookingStatus
    total_fare: float
    discount_amount: float
    expires_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True

class BookingStatusChange(BaseModel):
    status: BookingStatus
    reason: Optional[str] = None
''')

with open(f"{base_dir}/api/deps.py", "w") as f:
    f.write('''from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user_payload(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception
''')

with open(f"{base_dir}/services/redis_svc.py", "w") as f:
    f.write('''import json
import redis.asyncio as aioredis
from core.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

class RedisIdempotencyService:
    @staticmethod
    async def get_idempotency(key: str) -> dict:
        data = await redis_client.get(f"idem:{key}")
        return json.loads(data) if data else None

    @staticmethod
    async def set_idempotency(key: str, value: dict):
        # TTL 24 hours
        await redis_client.setex(f"idem:{key}", 86400, json.dumps(value))
''')

with open(f"{base_dir}/services/external.py", "w") as f:
    f.write('''import httpx
from core.config import settings

class ExternalServices:
    @staticmethod
    async def validate_promo(promo_code: str, fare_amount: float) -> float:
        # returns discount amount
        if not promo_code: return 0.0
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    f"{settings.DEALS_SERVICE_URL}/deals/validate", 
                    json={"promo_code": promo_code, "fare_amount": fare_amount},
                    timeout=5.0
                )
                if res.status_code == 200:
                    return res.json().get("data", {}).get("discount_amount", 0.0)
        except Exception:
            pass
        return 0.0

    @staticmethod
    async def lock_seats(trip_id: str, seat_numbers: list, booking_id: str, user_id: str):
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{settings.INVENTORY_SERVICE_URL}/inventory/trips/{trip_id}/seats/lock",
                json={
                    "seat_numbers": seat_numbers,
                    "booking_id": booking_id,
                    "user_id": user_id
                },
                timeout=5.0
            )
            res.raise_for_status()
            return res.json()
''')

with open(f"{base_dir}/services/kafka_consumer.py", "w") as f:
    f.write('''import json
import asyncio
from aiokafka import AIOKafkaConsumer
from sqlalchemy.future import select
from datetime import datetime, timezone
import sys
import os

from core.config import settings
from database import async_session
from models.models import Booking, BookingStatusHistory

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import BookingStatus
from shared.kafka_producer import KafkaProducerClient

class BookingKafkaConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            "payment.completed", "seat.lock.expired",
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id="booking-service-group",
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )

    async def start(self):
        await self.consumer.start()
        asyncio.create_task(self.consume())

    async def stop(self):
        await self.consumer.stop()

    async def consume(self):
        try:
            async for msg in self.consumer:
                await self.process_message(msg.topic, msg.value)
        except Exception as e:
            print(f"Consumer error: {e}")

    async def process_message(self, topic: str, message: dict):
        booking_id = message.get("booking_id")
        if not booking_id: return

        async with async_session() as db:
            query = select(Booking).where(Booking.id == booking_id)
            result = await db.execute(query)
            booking = result.scalars().first()
            if not booking: return

            old_status = booking.status

            if topic == "payment.completed":
                if booking.status == BookingStatus.PAYMENT_PENDING or booking.status == BookingStatus.SEAT_LOCKED:
                    booking.status = BookingStatus.CONFIRMED
                    booking.payment_id = message.get("payment_id")
                    
                    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=booking.status, reason="Payment Completed")
                    db.add(history)
                    await db.commit()
                    
                    # Publish ticket.issued
                    await KafkaProducerClient.publish("ticket.issued", {
                        "booking_id": str(booking.id),
                        "user_id": str(booking.user_id),
                        "trip_id": str(booking.trip_id)
                    })

            elif topic == "seat.lock.expired":
                if booking.status == BookingStatus.SEAT_LOCKED:
                    booking.status = BookingStatus.EXPIRED
                    
                    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=booking.status, reason="Seat Lock Expired via Kafka")
                    db.add(history)
                    await db.commit()
                    
                    await KafkaProducerClient.publish("audit.log", {
                        "event": "booking.expired", "booking_id": str(booking.id), "timestamp": datetime.now(timezone.utc).isoformat()
                    })
''')

with open(f"{base_dir}/services/scheduler.py", "w") as f:
    f.write('''from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.future import select
from datetime import datetime, timezone
import sys
import os

from database import async_session
from models.models import Booking, BookingStatusHistory

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import BookingStatus
from shared.kafka_producer import KafkaProducerClient

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('interval', minutes=1)
async def expire_stale_bookings():
    now = datetime.now(timezone.utc)
    async with async_session() as db:
        query = select(Booking).where(Booking.status == BookingStatus.SEAT_LOCKED, Booking.expires_at < now)
        result = await db.execute(query)
        bookings = result.scalars().all()
        
        for booking in bookings:
            old_status = booking.status
            booking.status = BookingStatus.EXPIRED
            history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=BookingStatus.EXPIRED, reason="Scheduler Lock Expired")
            db.add(history)
            
            await KafkaProducerClient.publish("seat.lock.expired", {
                "booking_id": str(booking.id),
                "trip_id": str(booking.trip_id)
            })
            await KafkaProducerClient.publish("audit.log", {
                "event": "booking.expired", "booking_id": str(booking.id), "timestamp": now.isoformat()
            })
            
        if bookings:
            await db.commit()
            print(f"Expired {len(bookings)} bookings")
''')

with open(f"{base_dir}/routers/bookings.py", "w") as f:
    f.write('''from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
from datetime import datetime, timedelta, timezone
import uuid

from database import get_db
from models.models import Booking, BookingStatusHistory
from schemas.schemas import BookingCreate, BookingResponse
from api.deps import get_current_user_payload
from services.redis_svc import RedisIdempotencyService
from services.external import ExternalServices

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.enums import BookingStatus
from shared.kafka_producer import KafkaProducerClient

router = APIRouter(prefix="/bookings", tags=["bookings"])

@router.post("/", response_model=BaseResponse)
async def create_booking(req: BookingCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    # 1. Idempotency Check
    cached_resp = await RedisIdempotencyService.get_idempotency(req.idempotency_key)
    if cached_resp:
        return BaseResponse(success=True, data=cached_resp, message="Retrieved from cache")

    user_id = payload.get("user_id")

    # 2. Promo Validation
    discount = await ExternalServices.validate_promo(req.promo_code, req.total_fare)
    
    # 3. Create Booking Record
    booking_id = uuid.uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    booking = Booking(
        id=booking_id,
        user_id=user_id,
        trip_id=req.trip_id,
        operator_id=req.operator_id,
        seat_numbers=req.seat_numbers,
        passenger_details=[p.model_dump() for p in req.passenger_details],
        boarding_point=req.boarding_point,
        dropping_point=req.dropping_point,
        journey_date=req.journey_date,
        departure_time=req.departure_time,
        total_fare=req.total_fare,
        discount_amount=discount,
        promo_code=req.promo_code,
        status=BookingStatus.SEAT_LOCKED,
        idempotency_key=req.idempotency_key,
        expires_at=expires_at
    )
    
    # 4. Lock Seats in Inventory
    try:
        await ExternalServices.lock_seats(str(req.trip_id), req.seat_numbers, str(booking_id), str(user_id))
    except Exception as e:
        raise HTTPException(status_code=409, detail=f"Failed to lock seats: {str(e)}")

    db.add(booking)
    history = BookingStatusHistory(booking_id=booking.id, from_status=BookingStatus.INITIATED, to_status=BookingStatus.SEAT_LOCKED, reason="Seats Locked Successfully")
    db.add(history)
    await db.commit()

    response_data = {
        "booking_id": str(booking.id),
        "expires_at": expires_at.isoformat(),
        "total_fare": float(booking.total_fare - booking.discount_amount)
    }

    # 5. Set Cache and Publish Events
    await RedisIdempotencyService.set_idempotency(req.idempotency_key, response_data)
    
    await KafkaProducerClient.publish("booking.created", response_data)
    await KafkaProducerClient.publish("audit.log", {"event": "booking.created", "booking_id": str(booking.id), "timestamp": datetime.now(timezone.utc).isoformat()})

    return BaseResponse(success=True, data=response_data, message="Booking created successfully")

@router.get("/my", response_model=BaseResponse[List[BookingResponse]])
async def get_my_bookings(skip: int = Query(0, ge=0), limit: int = Query(20, gt=0), db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("user_id")
    query = select(Booking).where(Booking.user_id == user_id).order_by(Booking.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    bookings = result.scalars().all()
    return BaseResponse(success=True, data=[BookingResponse.model_validate(b) for b in bookings])

@router.get("/{booking_id}", response_model=BaseResponse[BookingResponse])
async def get_booking(booking_id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    query = select(Booking).where(Booking.id == booking_id, Booking.user_id == payload.get("user_id"))
    result = await db.execute(query)
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return BaseResponse(success=True, data=BookingResponse.model_validate(booking))

@router.post("/{booking_id}/confirm-payment")
async def confirm_payment_internal(booking_id: UUID, payment_id: UUID, db: AsyncSession = Depends(get_db)):
    # Usually internal or heavily secured, maybe omit payload check for system communication.
    query = select(Booking).where(Booking.id == booking_id)
    result = await db.execute(query)
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    old_status = booking.status
    booking.status = BookingStatus.CONFIRMED
    booking.payment_id = payment_id
    
    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=booking.status, reason="Payment Configuration Endpoint")
    db.add(history)
    await db.commit()

    await KafkaProducerClient.publish("ticket.issued", {
        "booking_id": str(booking.id),
        "user_id": str(booking.user_id),
        "trip_id": str(booking.trip_id)
    })
    
    return BaseResponse(success=True, message="Booking confirmed")

@router.post("/{booking_id}/cancel")
async def cancel_booking(booking_id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    query = select(Booking).where(Booking.id == booking_id, Booking.user_id == payload.get("user_id"))
    result = await db.execute(query)
    booking = result.scalars().first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status in [BookingStatus.CANCELLED, BookingStatus.REFUNDED, BookingStatus.EXPIRED]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel booking in {booking.status} status")
        
    # Cancellation rules go here (time checks etc)

    old_status = booking.status
    booking.status = BookingStatus.CANCELLED
    
    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=booking.status, reason="User Cancelled")
    db.add(history)
    await db.commit()

    await KafkaProducerClient.publish("booking.cancelled", {"booking_id": str(booking.id), "trip_id": str(booking.trip_id)})

    return BaseResponse(success=True, message="Booking cancelled successfully")
''')

with open(f"{base_dir}/main.py", "w") as f:
    f.write('''from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.bookings import router as bookings_router
from models.base import Base
from database import engine
from services.scheduler import scheduler
from services.kafka_consumer import BookingKafkaConsumer

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

app = FastAPI(title="Booking Service")
kafka_consumer = BookingKafkaConsumer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(bookings_router)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    scheduler.start()
    await kafka_consumer.start()

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
    await kafka_consumer.stop()

@app.get("/")
async def root():
    return {"message": "Booking service is running"}
''')

print("Booking Scaffold Done")
