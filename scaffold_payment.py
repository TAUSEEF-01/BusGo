import os

base_dir = "busgo/services/payment-service"
os.makedirs(f"{base_dir}/core", exist_ok=True)
os.makedirs(f"{base_dir}/api", exist_ok=True)
os.makedirs(f"{base_dir}/models", exist_ok=True)
os.makedirs(f"{base_dir}/schemas", exist_ok=True)
os.makedirs(f"{base_dir}/services", exist_ok=True)
os.makedirs(f"{base_dir}/routers", exist_ok=True)

with open(f"{base_dir}/requirements.txt", "a") as f:
    f.write("redis\naiokafka\nhttpx\npython-jose[cryptography]\n")

with open(f"{base_dir}/core/config.py", "w") as f:
    f.write('''import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey-please-change-in-production")
    ALGORITHM: str = "HS256"
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    BOOKING_SERVICE_URL: str = os.getenv("BOOKING_SERVICE_URL", "http://booking-service:8000")

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
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from .base import Base

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import PaymentMethod

class PaymentStatus(str, enum.Enum):
    PENDING = 'PENDING'
    COMPLETED = 'COMPLETED'
    FAILED = 'FAILED'
    REFUNDED = 'REFUNDED'

class RefundStatus(str, enum.Enum):
    PENDING = 'PENDING'
    PROCESSING = 'PROCESSING'
    COMPLETED = 'COMPLETED'
    FAILED = 'FAILED'

class Payment(Base):
    __tablename__ = "payments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    trip_id = Column(UUID(as_uuid=True), index=True, nullable=False) # added for fraud detection
    
    amount = Column(Numeric(10, 2), nullable=False)
    method = Column(Enum(PaymentMethod), nullable=False)
    gateway_transaction_id = Column(String, nullable=True, unique=True)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    gateway_response = Column(JSONB, nullable=True)
    
    initiated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    refunds = relationship("Refund", back_populates="payment")

class Refund(Base):
    __tablename__ = "refunds"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=False)
    booking_id = Column(UUID(as_uuid=True), nullable=False)
    
    amount = Column(Numeric(10, 2), nullable=False)
    reason = Column(String, nullable=False)
    status = Column(Enum(RefundStatus), default=RefundStatus.PENDING)
    gateway_refund_id = Column(String, nullable=True)
    
    initiated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    estimated_days = Column(Integer, nullable=False)

    payment = relationship("Payment", back_populates="refunds")
''')

with open(f"{base_dir}/schemas/schemas.py", "w") as f:
    f.write('''from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from models.models import PaymentStatus, RefundStatus
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import PaymentMethod

class InitiateRequest(BaseModel):
    booking_id: UUID
    trip_id: UUID
    amount: float
    method: PaymentMethod

class InitiateResponse(BaseModel):
    payment_id: UUID
    redirect_url: str

class CallbackRequest(BaseModel):
    gateway_transaction_id: str
    status: str
    response_data: Dict[str, Any]

class PaymentResponse(BaseModel):
    id: UUID
    booking_id: UUID
    user_id: UUID
    trip_id: UUID
    amount: float
    method: PaymentMethod
    gateway_transaction_id: Optional[str]
    status: PaymentStatus
    initiated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True

class RefundRequest(BaseModel):
    reason: str

class RefundResponse(BaseModel):
    id: UUID
    payment_id: UUID
    booking_id: UUID
    amount: float
    reason: str
    status: RefundStatus
    estimated_days: int
    initiated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True
''')

with open(f"{base_dir}/api/deps.py", "w") as f:
    f.write('''from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_current_user_payload(request: Request, token: str = Depends(oauth2_scheme)):
    if not token:
        # Check authorization header manually if OAuth2 auto_error restricts
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth.split(" ")[1]
        else:
            return {"user_id": "system"} # Internal system calls

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
''')

with open(f"{base_dir}/services/booking_client.py", "w") as f:
    f.write('''import httpx
from core.config import settings
from typing import Optional, Dict, Any

class BookingClient:
    @staticmethod
    async def get_booking(booking_id: str, auth_token: str) -> Optional[Dict[str, Any]]:
        headers = {}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
            
        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(
                    f"{settings.BOOKING_SERVICE_URL}/bookings/{booking_id}",
                    headers=headers,
                    timeout=5.0
                )
                if res.status_code == 200:
                    return res.json().get("data")
            except Exception as e:
                print(f"Booking fetch error: {e}")
        return None
''')

with open(f"{base_dir}/services/gateway.py", "w") as f:
    f.write('''import asyncio
import uuid
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import PaymentMethod

class MockGateway:
    _simulate_failure = False

    @classmethod
    def set_simulate_failure(cls, fail: bool):
        cls._simulate_failure = fail

    @classmethod
    def get_redirect_url(cls, payment_id: str, method: PaymentMethod) -> str:
        if method == PaymentMethod.BKASH:
            return f"https://mock-bkash.com/checkout/{payment_id}"
        elif method == PaymentMethod.NAGAD:
            return f"https://mock-nagad.com/pay/{payment_id}"
        else:
            return f"https://mock-sslcommerz.com/gw/{payment_id}"

    @classmethod
    async def process_refund(cls, amount: float, method: PaymentMethod) -> dict:
        await asyncio.sleep(2) # Mock 2 second delay
        
        if cls._simulate_failure:
            return {"success": False, "refund_id": None}
            
        return {
            "success": True,
            "refund_id": f"ref_{uuid.uuid4().hex[:10]}"
        }
''')

with open(f"{base_dir}/routers/payments.py", "w") as f:
    f.write('''from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
from datetime import datetime, timezone
import asyncio

from database import get_db
from models.models import Payment, PaymentStatus, Refund, RefundStatus
from schemas.schemas import (InitiateRequest, InitiateResponse, CallbackRequest, 
                             PaymentResponse, RefundRequest, RefundResponse)
from api.deps import get_current_user_payload
from services.booking_client import BookingClient
from services.gateway import MockGateway

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.enums import PaymentMethod
from shared.kafka_producer import KafkaProducerClient

router = APIRouter(prefix="/payments", tags=["payments"])

@router.post("/mock/simulate-failure", response_model=BaseResponse)
async def toggle_simulate_failure(fail: bool):
    MockGateway.set_simulate_failure(fail)
    return BaseResponse(success=True, message=f"Simulate failure set to {fail}")

@router.post("/initiate", response_model=BaseResponse[InitiateResponse])
async def initiate_payment(req: InitiateRequest, request: Request, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("user_id")

    # Fraud Detection 1: Mount mismatch
    auth_header = request.headers.get("Authorization", "").replace("Bearer ", "")
    booking = await BookingClient.get_booking(str(req.booking_id), auth_header)
    if not booking:
        booking = {"total_fare": req.amount, "trip_id": str(req.trip_id)} # Fallback for dev if booking service unreachable
        
    actual_fare = float(booking.get("total_fare", 0)) - float(booking.get("discount_amount", 0))
    if abs(actual_fare - req.amount) > 0.01: # allow tiny float diff
        await KafkaProducerClient.publish("audit.log", {
            "event": "fraud.detected", "user_id": user_id, "reason": "Amount mismatch", "booking_id": str(req.booking_id)
        })
        raise HTTPException(status_code=400, detail="Payment amount does not match booking fare")

    # Fraud Detection 2: Multiple attempts
    trip_id = booking.get("trip_id", str(req.trip_id))
    attempts_query = select(Payment).where(Payment.user_id == user_id, Payment.trip_id == trip_id)
    attempts_res = await db.execute(attempts_query)
    attempts = len(attempts_res.scalars().all())
    
    if attempts >= 3:
        await KafkaProducerClient.publish("audit.log", {
            "event": "fraud.detected", "user_id": user_id, "reason": "Max payment attempts exceeded", "trip_id": trip_id
        })
        raise HTTPException(status_code=403, detail="Maximum payment attempts exceeded for this trip")

    payment = Payment(
        booking_id=req.booking_id,
        user_id=user_id,
        trip_id=trip_id,
        amount=req.amount,
        method=req.method,
        status=PaymentStatus.PENDING
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    redirect_url = MockGateway.get_redirect_url(str(payment.id), req.method)
    
    return BaseResponse(success=True, data=InitiateResponse(payment_id=payment.id, redirect_url=redirect_url))

@router.post("/{gateway}/callback", response_model=BaseResponse)
async def payment_callback(gateway: str, payment_id: UUID, req: CallbackRequest, db: AsyncSession = Depends(get_db)):
    # This acts as webhook catcher (e.g. /payments/bkash/callback?payment_id=...)
    query = select(Payment).where(Payment.id == payment_id)
    result = await db.execute(query)
    payment = result.scalars().first()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    await asyncio.sleep(2) # Mock 2 sec processing delay

    if req.status.upper() == "SUCCESS" and not MockGateway._simulate_failure:
        payment.status = PaymentStatus.COMPLETED
        payment.gateway_transaction_id = req.gateway_transaction_id
        payment.completed_at = datetime.now(timezone.utc)
        payment.gateway_response = req.response_data
        
        await db.commit()
        
        await KafkaProducerClient.publish("payment.completed", {
            "booking_id": str(payment.booking_id),
            "payment_id": str(payment.id),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        await KafkaProducerClient.publish("audit.log", {
            "event": "payment.completed", "payment_id": str(payment.id)
        })
        return BaseResponse(success=True, message="Payment completed")
    else:
        payment.status = PaymentStatus.FAILED
        payment.gateway_response = req.response_data
        await db.commit()
        return BaseResponse(success=False, message="Payment failed")

@router.get("/{payment_id}", response_model=BaseResponse[PaymentResponse])
async def get_payment(payment_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return BaseResponse(success=True, data=PaymentResponse.model_validate(payment))

@router.get("/booking/{booking_id}", response_model=BaseResponse[List[PaymentResponse]])
async def get_booking_payments(booking_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Payment).where(Payment.booking_id == booking_id))
    payments = result.scalars().all()
    return BaseResponse(success=True, data=[PaymentResponse.model_validate(p) for p in payments])

@router.post("/{payment_id}/refund", response_model=BaseResponse[RefundResponse])
async def process_refund(payment_id: UUID, req: RefundRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalars().first()
    
    if not payment or payment.status != PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Valid completed payment required for refund")

    est_days = 5 if payment.method in [PaymentMethod.BKASH, PaymentMethod.NAGAD] else 7
    
    refund = Refund(
        payment_id=payment.id,
        booking_id=payment.booking_id,
        amount=payment.amount,
        reason=req.reason,
        status=RefundStatus.PROCESSING,
        estimated_days=est_days
    )
    db.add(refund)
    await db.commit()
    await db.refresh(refund)

    # Mock gateway call
    gw_res = await MockGateway.process_refund(float(refund.amount), payment.method)
    
    if gw_res["success"]:
        refund.status = RefundStatus.COMPLETED
        refund.gateway_refund_id = gw_res["refund_id"]
        refund.completed_at = datetime.now(timezone.utc)
        payment.status = PaymentStatus.REFUNDED
        
        await KafkaProducerClient.publish("refund.initiated", {
            "refund_id": str(refund.id), "payment_id": str(payment.id), "booking_id": str(payment.booking_id)
        })
        await KafkaProducerClient.publish("audit.log", {
            "event": "refund.completed", "refund_id": str(refund.id)
        })
    else:
        refund.status = RefundStatus.FAILED
        
    await db.commit()
    
    return BaseResponse(success=gw_res["success"], data=RefundResponse.model_validate(refund))
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
from models.models import Payment, PaymentStatus, Refund, RefundStatus
from services.gateway import MockGateway

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import PaymentMethod
from shared.kafka_producer import KafkaProducerClient

class PaymentKafkaConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            "booking.cancelled",
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id="payment-service-group",
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
            if topic == "booking.cancelled":
                # Find completed payments for this booking
                query = select(Payment).where(Payment.booking_id == booking_id, Payment.status == PaymentStatus.COMPLETED)
                result = await db.execute(query)
                payments = result.scalars().all()
                
                for payment in payments:
                    print(f"Auto-triggering refund for cancelled booking payment {payment.id}")
                    est_days = 5 if payment.method in [PaymentMethod.BKASH, PaymentMethod.NAGAD] else 7
                    refund = Refund(
                        payment_id=payment.id,
                        booking_id=payment.booking_id,
                        amount=payment.amount,
                        reason="Auto-refund due to booking cancellation",
                        status=RefundStatus.PROCESSING,
                        estimated_days=est_days
                    )
                    db.add(refund)
                    await db.commit()
                    
                    gw_res = await MockGateway.process_refund(float(refund.amount), payment.method)
                    
                    if gw_res["success"]:
                        refund.status = RefundStatus.COMPLETED
                        refund.gateway_refund_id = gw_res["refund_id"]
                        refund.completed_at = datetime.now(timezone.utc)
                        payment.status = PaymentStatus.REFUNDED
                        
                        await KafkaProducerClient.publish("refund.initiated", {
                            "refund_id": str(refund.id), "payment_id": str(payment.id), "booking_id": str(payment.booking_id)
                        })
                    else:
                        refund.status = RefundStatus.FAILED
                        
                    await db.commit()
''')

with open(f"{base_dir}/main.py", "w") as f:
    f.write('''from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.payments import router as payments_router
from models.base import Base
from database import engine
from services.kafka_consumer import PaymentKafkaConsumer

app = FastAPI(title="Payment Service")
kafka_consumer = PaymentKafkaConsumer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(payments_router)

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
    return {"message": "Payment service is running"}
''')

print("Payment Scaffold Done")
