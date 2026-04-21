import os

base_dir = "busgo/services/inventory-service"
os.makedirs(f"{base_dir}/core", exist_ok=True)
os.makedirs(f"{base_dir}/api", exist_ok=True)
os.makedirs(f"{base_dir}/models", exist_ok=True)
os.makedirs(f"{base_dir}/schemas", exist_ok=True)
os.makedirs(f"{base_dir}/services", exist_ok=True)
os.makedirs(f"{base_dir}/routers", exist_ok=True)

with open(f"{base_dir}/requirements.txt", "a") as f:
    f.write("redis\naiokafka\n")

with open(f"{base_dir}/core/config.py", "w") as f:
    f.write('''import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey-please-change-in-production")
    ALGORITHM: str = "HS256"
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/1")
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

settings = Settings()
''')

with open(f"{base_dir}/models/base.py", "w") as f:
    f.write('''from sqlalchemy.orm import declarative_base
Base = declarative_base()
''')

with open(f"{base_dir}/models/models.py", "w") as f:
    f.write('''import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import Column, String, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from .base import Base

class SeatType(str, enum.Enum):
    WINDOW = 'WINDOW'
    AISLE = 'AISLE'
    SLEEPER_UPPER = 'SLEEPER_UPPER'
    SLEEPER_LOWER = 'SLEEPER_LOWER'

class SeatStatus(str, enum.Enum):
    AVAILABLE = 'AVAILABLE'
    LOCKED = 'LOCKED'
    BOOKED = 'BOOKED'

class SeatInventory(Base):
    __tablename__ = "seat_inventory"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    seat_number = Column(String, nullable=False)
    seat_type = Column(Enum(SeatType), nullable=False)
    status = Column(Enum(SeatStatus), default=SeatStatus.AVAILABLE)
    locked_by_booking_id = Column(UUID(as_uuid=True), nullable=True)
    lock_expires_at = Column(DateTime(timezone=True), nullable=True)
    booked_by_user_id = Column(UUID(as_uuid=True), nullable=True)
''')

with open(f"{base_dir}/schemas/schemas.py", "w") as f:
    f.write('''from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from models.models import SeatStatus, SeatType

class SeatResponse(BaseModel):
    id: UUID
    trip_id: UUID
    seat_number: str
    seat_type: SeatType
    status: SeatStatus
    locked_by_booking_id: Optional[UUID]
    lock_expires_at: Optional[datetime]
    booked_by_user_id: Optional[UUID]

    class Config:
        from_attributes = True

class LockRequest(BaseModel):
    seat_numbers: List[str]
    booking_id: UUID
    user_id: UUID

class LockResponse(BaseModel):
    locked: List[str]
    expires_at: datetime
    
class ReleaseRequest(BaseModel):
    seat_numbers: Optional[List[str]] = None
    booking_id: UUID
    
class ConfirmRequest(BaseModel):
    seat_numbers: List[str]
    booking_id: UUID
    user_id: UUID

class InitializeRequest(BaseModel):
    seat_layout: List[Dict[str, Any]] # e.g. [{"number": "A1", "type": "WINDOW"}, ...]
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
    f.write('''import redis.asyncio as aioredis
from core.config import settings
from typing import Optional

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

class RedisInventoryService:
    LOCK_TTL = 600

    @staticmethod
    async def lock_seat(trip_id: str, seat_number: str, booking_id: str) -> bool:
        key = f"seat_lock:{trip_id}:{seat_number}"
        # Set NX (Not eXists) ensuring atomicity
        return await redis_client.set(key, booking_id, nx=True, ex=RedisInventoryService.LOCK_TTL)

    @staticmethod
    async def unlock_seat(trip_id: str, seat_number: str):
        key = f"seat_lock:{trip_id}:{seat_number}"
        await redis_client.delete(key)

    @staticmethod
    async def get_seat_lock(trip_id: str, seat_number: str) -> Optional[str]:
        key = f"seat_lock:{trip_id}:{seat_number}"
        return await redis_client.get(key)
''')

with open(f"{base_dir}/routers/inventory.py", "w") as f:
    f.write('''from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict
from uuid import UUID
from datetime import datetime, timezone, timedelta

from database import get_db
from models.models import SeatInventory, SeatStatus, SeatType
from schemas.schemas import (SeatResponse, LockRequest, LockResponse, 
                             ReleaseRequest, ConfirmRequest, InitializeRequest)
from api.deps import get_current_user_payload
from services.redis_svc import RedisInventoryService

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.exceptions import SeatAlreadyLocked

router = APIRouter(prefix="/inventory/trips", tags=["inventory"])

@router.post("/{trip_id}/initialize", response_model=BaseResponse)
async def initialize_inventory(trip_id: UUID, req: InitializeRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SeatInventory).where(SeatInventory.trip_id == trip_id))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Inventory already initialized for this trip")

    seats = []
    for s_info in req.seat_layout:
        seats.append(SeatInventory(
            trip_id=trip_id,
            seat_number=s_info["number"],
            seat_type=SeatType(s_info["type"]),
            status=SeatStatus.AVAILABLE
        ))
    db.add_all(seats)
    await db.commit()
    return BaseResponse(success=True, message="Inventory initialized")

@router.get("/{trip_id}/seats", response_model=BaseResponse[List[SeatResponse]])
async def get_seats(trip_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SeatInventory).where(SeatInventory.trip_id == trip_id))
    seats = result.scalars().all()
    
    # Overlay Redis locks
    for seat in seats:
        if seat.status == SeatStatus.AVAILABLE:
            booking_id = await RedisInventoryService.get_seat_lock(str(trip_id), seat.seat_number)
            if booking_id:
                seat.status = SeatStatus.LOCKED
                seat.locked_by_booking_id = UUID(booking_id)
                # Approximate expiry based on fact it's in Redis
                
    return BaseResponse(success=True, data=[SeatResponse.model_validate(s) for s in seats])

@router.get("/{trip_id}/available-count", response_model=BaseResponse[Dict[str, int]])
async def get_available_count(trip_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SeatInventory).where(
        SeatInventory.trip_id == trip_id, 
        SeatInventory.status == SeatStatus.AVAILABLE
    ))
    seats = result.scalars().all()
    
    available = 0
    for seat in seats:
        booking_id = await RedisInventoryService.get_seat_lock(str(trip_id), seat.seat_number)
        if not booking_id:
            available += 1
            
    return BaseResponse(success=True, data={"available_seats": available})

@router.post("/{trip_id}/seats/lock", response_model=BaseResponse[LockResponse])
async def lock_seats(trip_id: UUID, req: LockRequest, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    # Check DB status first
    result = await db.execute(select(SeatInventory).where(
        SeatInventory.trip_id == trip_id,
        SeatInventory.seat_number.in_(req.seat_numbers)
    ))
    seats = result.scalars().all()
    
    if len(seats) != len(req.seat_numbers):
        raise HTTPException(status_code=400, detail="One or more seats not found")
        
    for seat in seats:
        if seat.status == SeatStatus.BOOKED:
            raise SeatAlreadyLocked(f"Seat {seat.seat_number} is already booked")
            
    # Try locking in Redis
    locked_seats = []
    for sn in req.seat_numbers:
        success = await RedisInventoryService.lock_seat(str(trip_id), sn, str(req.booking_id))
        if success:
            locked_seats.append(sn)
        else:
            # Rollback locks if failing midway
            for lsn in locked_seats:
                await RedisInventoryService.unlock_seat(str(trip_id), lsn)
            raise SeatAlreadyLocked(f"Seat {sn} is already locked")
            
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=RedisInventoryService.LOCK_TTL)
    
    # Optionally update DB status to LOCKED
    for seat in seats:
        seat.status = SeatStatus.LOCKED
        seat.locked_by_booking_id = req.booking_id
        seat.lock_expires_at = expires_at
    await db.commit()
    
    return BaseResponse(success=True, data=LockResponse(locked=locked_seats, expires_at=expires_at))

@router.post("/{trip_id}/seats/release", response_model=BaseResponse)
async def release_seats(trip_id: UUID, req: ReleaseRequest, db: AsyncSession = Depends(get_db)):
    query = select(SeatInventory).where(
        SeatInventory.trip_id == trip_id,
        SeatInventory.locked_by_booking_id == req.booking_id
    )
    if req.seat_numbers:
        query = query.where(SeatInventory.seat_number.in_(req.seat_numbers))
        
    result = await db.execute(query)
    seats = result.scalars().all()
    
    for seat in seats:
        if seat.status != SeatStatus.BOOKED:
            seat.status = SeatStatus.AVAILABLE
            seat.locked_by_booking_id = None
            seat.lock_expires_at = None
        await RedisInventoryService.unlock_seat(str(trip_id), seat.seat_number)
        
    await db.commit()
    return BaseResponse(success=True, message="Seats released")

@router.post("/{trip_id}/seats/confirm", response_model=BaseResponse)
async def confirm_seats(trip_id: UUID, req: ConfirmRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SeatInventory).where(
        SeatInventory.trip_id == trip_id,
        SeatInventory.seat_number.in_(req.seat_numbers),
        SeatInventory.locked_by_booking_id == req.booking_id
    ))
    seats = result.scalars().all()
    
    if len(seats) != len(req.seat_numbers):
        raise HTTPException(status_code=400, detail="Invalid seat confirmation request")
        
    for seat in seats:
        seat.status = SeatStatus.BOOKED
        seat.booked_by_user_id = req.user_id
        await RedisInventoryService.unlock_seat(str(trip_id), seat.seat_number)
        
    await db.commit()
    return BaseResponse(success=True, message="Seats confirmed")
''')

with open(f"{base_dir}/services/kafka_consumer.py", "w") as f:
    f.write('''import json
import asyncio
from aiokafka import AIOKafkaConsumer
from core.config import settings
from database import async_session
from sqlalchemy.future import select
from models.models import SeatInventory, SeatStatus
from services.redis_svc import RedisInventoryService

class InventoryKafkaConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            "seat.lock.expired", "booking.cancelled",
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id="inventory-service-group",
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
        trip_id = message.get("trip_id")
        if not booking_id:
            return

        async with async_session() as db:
            query = select(SeatInventory).where(SeatInventory.locked_by_booking_id == booking_id)
            if trip_id:
                query = query.where(SeatInventory.trip_id == trip_id)
                
            result = await db.execute(query)
            seats = result.scalars().all()

            for seat in seats:
                if seat.status != SeatStatus.BOOKED:
                    seat.status = SeatStatus.AVAILABLE
                    seat.locked_by_booking_id = None
                    seat.lock_expires_at = None
                await RedisInventoryService.unlock_seat(str(seat.trip_id), seat.seat_number)

            await db.commit()
            print(f"Processed {topic} for booking {booking_id}")
''')

with open(f"{base_dir}/main.py", "w") as f:
    f.write('''from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from routers.inventory import router as inventory_router
from models.base import Base
from database import engine
from services.kafka_consumer import InventoryKafkaConsumer
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from shared.exceptions import SeatAlreadyLocked
from shared.base_response import BaseResponse

app = FastAPI(title="Inventory Service")
kafka_consumer = InventoryKafkaConsumer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.exception_handler(SeatAlreadyLocked)
async def seat_already_locked_handler(request: Request, exc: SeatAlreadyLocked):
    return JSONResponse(
        status_code=409,
        content=BaseResponse(success=False, message=str(exc)).model_dump()
    )

app.include_router(inventory_router)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await kafka_consumer.start()

@app.on_event("shutdown")
async def shutdown():
    await kafka_consumer.stop()

@app.get("/")
async def root():
    return {"message": "Inventory service is running"}
''')

print("Inventory Scaffold Done")
