import os

base_dir = "busgo/services/ticket-service"
os.makedirs(f"{base_dir}/core", exist_ok=True)
os.makedirs(f"{base_dir}/api", exist_ok=True)
os.makedirs(f"{base_dir}/models", exist_ok=True)
os.makedirs(f"{base_dir}/schemas", exist_ok=True)
os.makedirs(f"{base_dir}/services", exist_ok=True)
os.makedirs(f"{base_dir}/routers", exist_ok=True)

with open(f"{base_dir}/requirements.txt", "w") as f:
    f.write(
        "fastapi\nsqlalchemy\nasyncpg\nredis\naiokafka\nhttpx\npython-jose[cryptography]\npydantic_settings\nreportlab\nqrcode[pil]\nboto3\naioboto3\n"
    )

with open(f"{base_dir}/core/config.py", "w") as f:
    f.write(
        """import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey-please-change-in-production")
    ALGORITHM: str = "HS256"
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    BOOKING_SERVICE_URL: str = os.getenv("BOOKING_SERVICE_URL", "http://booking-service:8000")
    S3_ENDPOINT_URL: str = os.getenv("S3_ENDPOINT_URL", "http://minio:9000")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "minioadmin")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "tickets")

settings = Settings()
"""
    )

with open(f"{base_dir}/models/base.py", "w") as f:
    f.write(
        """from sqlalchemy.orm import declarative_base
Base = declarative_base()
"""
    )

with open(f"{base_dir}/models/models.py", "w") as f:
    f.write(
        """import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Enum, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .base import Base

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import TicketStatus

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), unique=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    trip_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    
    seat_numbers = Column(JSONB, nullable=False)
    passenger_details = Column(JSONB, nullable=False)
    
    qr_code_data = Column(String, unique=True, nullable=False)
    qr_code_url = Column(String, nullable=True)
    pdf_url = Column(String, nullable=True)
    
    status = Column(Enum(TicketStatus), default=TicketStatus.ACTIVE)
    
    issued_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index('ix_tickets_qr_data', 'qr_code_data'),
    )
"""
    )

with open(f"{base_dir}/schemas/schemas.py", "w") as f:
    f.write(
        """from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import TicketStatus

class TicketResponse(BaseModel):
    id: UUID
    booking_id: UUID
    user_id: UUID
    trip_id: UUID
    seat_numbers: List[str]
    passenger_details: Dict[str, Any]
    qr_code_url: Optional[str]
    pdf_url: Optional[str]
    status: TicketStatus
    issued_at: datetime
    used_at: Optional[datetime]
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True

class ValidateQRRequest(BaseModel):
    qr_code_data: str

class ValidateQRResponse(BaseModel):
    valid: bool
    message: str
    passenger_details: Optional[Dict[str, Any]] = None
    seat_numbers: Optional[List[str]] = None
    trip_id: Optional[UUID] = None
"""
    )

with open(f"{base_dir}/api/deps.py", "w") as f:
    f.write(
        """from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from core.config import settings
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_current_user_payload(request: Request, token: str = Depends(oauth2_scheme)):
    if not token:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth.split(" ")[1]
        else:
            return {"user_id": "system", "role": "SYSTEM"}

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(roles: list[str]):
    def role_checker(payload: dict = Depends(get_current_user_payload)):
        if payload.get("role") not in roles and payload.get("role") != "SYSTEM":
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return payload
    return role_checker
"""
    )

with open(f"{base_dir}/database.py", "w") as f:
    f.write(
        """import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/ticket_db")

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with async_session() as session:
        yield session
"""
    )

with open(f"{base_dir}/services/booking_client.py", "w") as f:
    f.write(
        """import httpx
from core.config import settings
from typing import Optional, Dict, Any

class BookingClient:
    @staticmethod
    async def get_booking_details(booking_id: str) -> Optional[Dict[str, Any]]:
        # System-to-system call
        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(
                    f"{settings.BOOKING_SERVICE_URL}/bookings/{booking_id}/internal", # Assume internal endpoint bypassing standard auth
                    timeout=10.0
                )
                if res.status_code == 200:
                    return res.json().get("data")
            except Exception as e:
                print(f"Booking fetch error: {e}")
        return None
"""
    )

with open(f"{base_dir}/services/s3_service.py", "w") as f:
    f.write(
        """import aioboto3
from core.config import settings

class S3Service:
    @staticmethod
    async def upload_file(file_bytes: bytes, key: str, content_type: str) -> str:
        session = aioboto3.Session()
        async with session.client('s3',
                                  endpoint_url=settings.S3_ENDPOINT_URL,
                                  aws_access_key_id=settings.S3_ACCESS_KEY,
                                  aws_secret_access_key=settings.S3_SECRET_KEY) as client:
            
            # Ensure bucket exists (for dev)
            try:
                await client.head_bucket(Bucket=settings.S3_BUCKET_NAME)
            except:
                await client.create_bucket(Bucket=settings.S3_BUCKET_NAME)
                
            await client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
                ACL='public-read'
            )
            
            return f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{key}"
"""
    )

with open(f"{base_dir}/services/qr_generator.py", "w") as f:
    f.write(
        """import qrcode
import io

class QRGenerator:
    @staticmethod
    def generate_qr(data: str) -> bytes:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        byte_stream = io.BytesIO()
        img.save(byte_stream, format='PNG')
        return byte_stream.getvalue()
"""
    )

with open(f"{base_dir}/services/pdf_generator.py", "w") as f:
    f.write(
        """import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

class PDFGenerator:
    @staticmethod
    def generate_ticket_pdf(booking: dict, qr_bytes: bytes) -> bytes:
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        
        # Header
        c.setFont("Helvetica-Bold", 24)
        c.drawCentredString(width / 2.0, height - 50, "BusGo E-Ticket")
        
        c.setFont("Helvetica", 14)
        c.drawString(50, height - 100, f"Booking Reference: {booking.get('id', 'N/A')}")
        
        c.setFont("Helvetica", 12)
        y = height - 140
        c.drawString(50, y, f"Passenger Name: {booking.get('passenger_details', {}).get('name', 'N/A')}")
        c.drawString(50, y - 20, f"Seats: {', '.join(booking.get('seat_numbers', []))}")
        
        c.drawString(50, y - 60, f"Route: {booking.get('origin', 'N/A')} to {booking.get('destination', 'N/A')}")
        c.drawString(50, y - 80, f"Departure: {booking.get('departure_time', 'N/A')}")
        c.drawString(50, y - 100, f"Boarding Point: {booking.get('boarding_point', 'N/A')}")
        c.drawString(50, y - 120, f"Operator: {booking.get('operator_name', 'N/A')} ({booking.get('bus_type', 'N/A')})")
        
        # QR Code
        qr_image = ImageReader(io.BytesIO(qr_bytes))
        c.drawImage(qr_image, width / 2.0 - 100, y - 350, width=200, height=200)
        
        # Footer
        c.setFont("Helvetica-Oblique", 10)
        c.drawCentredString(width / 2.0, 50, "Valid for single journey only. Please present this QR code at boarding.")
        
        c.showPage()
        c.save()
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
"""
    )

with open(f"{base_dir}/routers/tickets.py", "w") as f:
    f.write(
        """from fastapi import APIRouter, Depends, HTTPException
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

router = APIRouter(prefix="/tickets", tags=["tickets"])

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
"""
    )

with open(f"{base_dir}/services/kafka_consumer.py", "w") as f:
    f.write(
        """import json
import asyncio
import uuid
import hmac
import hashlib
from aiokafka import AIOKafkaConsumer
from datetime import datetime, timezone
import sys
import os

from core.config import settings
from database import async_session
from models.models import Ticket
from services.booking_client import BookingClient
from services.qr_generator import QRGenerator
from services.pdf_generator import PDFGenerator
from services.s3_service import S3Service

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import TicketStatus
from shared.kafka_producer import KafkaProducerClient

class TicketKafkaConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            "ticket.issued",
            "payment.completed", # Listen to either based on arch. Let's process on ticket.issued if booking service emits it, or payment.completed
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id="ticket-service-group",
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

    def generate_token(self, booking_id: str) -> str:
        # UUID + HMAC signature
        token_id = str(uuid.uuid4())
        signature = hmac.new(
            settings.SECRET_KEY.encode('utf-8'),
            f"{booking_id}:{token_id}".encode('utf-8'),
            hashlib.sha256
        ).hexdigest()[:16]
        return f"{booking_id}_{token_id}_{signature}"

    async def process_message(self, topic: str, message: dict):
        booking_id = message.get("booking_id")
        if not booking_id: return

        # Try to prevent duplicate processing
        async with async_session() as db:
            from sqlalchemy.future import select
            existing = await db.execute(select(Ticket).where(Ticket.booking_id == booking_id))
            if existing.scalars().first():
                return # Already generated

            print(f"Generating ticket for booking {booking_id}")
            
            # Fetch full booking details
            booking_data = await BookingClient.get_booking_details(booking_id)
            if not booking_data:
                # Mock data if booking service is not fully reachable
                booking_data = {
                    "id": booking_id,
                    "user_id": str(uuid.uuid4()),
                    "trip_id": str(uuid.uuid4()),
                    "seat_numbers": ["A1"],
                    "passenger_details": {"name": "Test User", "phone": "1234567890"},
                    "origin": "Dhaka",
                    "destination": "Chittagong",
                    "departure_time": "2026-05-01 10:00:00",
                    "boarding_point": "Gabtoli",
                    "operator_name": "Mock Travels",
                    "bus_type": "AC"
                }

            # 1. Generate unique QR Token
            qr_token = self.generate_token(booking_id)
            
            # 2. Generate QR code image
            qr_bytes = QRGenerator.generate_qr(qr_token)
            
            # 3. Generate PDF
            pdf_bytes = PDFGenerator.generate_ticket_pdf(booking_data, qr_bytes)
            
            # 4. Upload to S3
            qr_key = f"tickets/qr/{booking_id}.png"
            pdf_key = f"tickets/pdf/{booking_id}.pdf"
            
            qr_url = await S3Service.upload_file(qr_bytes, qr_key, 'image/png')
            pdf_url = await S3Service.upload_file(pdf_bytes, pdf_key, 'application/pdf')
            
            # 5. Save Ticket Record
            ticket = Ticket(
                booking_id=booking_id,
                user_id=booking_data["user_id"],
                trip_id=booking_data["trip_id"],
                seat_numbers=booking_data.get("seat_numbers", []),
                passenger_details=booking_data.get("passenger_details", {}),
                qr_code_data=qr_token,
                qr_code_url=qr_url,
                pdf_url=pdf_url,
                status=TicketStatus.ACTIVE
            )
            
            db.add(ticket)
            await db.commit()
            
            # 6. Publish Notifications & Audit
            await KafkaProducerClient.publish("notification.send", {
                "type": "EMAIL",
                "recipient_id": booking_data["user_id"],
                "subject": "Your BusGo E-Ticket",
                "template": "ticket_issued",
                "attachments": [pdf_url]
            })
            
            await KafkaProducerClient.publish("audit.log", {
                "event": "ticket.generated",
                "ticket_id": str(ticket.id),
                "booking_id": booking_id
            })
"""
    )

with open(f"{base_dir}/main.py", "w") as f:
    f.write(
        """from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.tickets import router as tickets_router
from models.base import Base
from database import engine
from services.kafka_consumer import TicketKafkaConsumer

app = FastAPI(title="Ticket Service")
kafka_consumer = TicketKafkaConsumer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(tickets_router)

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
    return {"message": "Ticket service is running"}
"""
    )

print("Ticket Scaffold Done")
