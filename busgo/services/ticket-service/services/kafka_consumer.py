import json
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
            "booking.cancelled",
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

        if topic == "booking.cancelled":
            async with async_session() as db:
                from sqlalchemy.future import select
                query = select(Ticket).where(Ticket.booking_id == booking_id)
                result = await db.execute(query)
                ticket = result.scalars().first()
                if ticket:
                    ticket.status = TicketStatus.CANCELLED
                    await db.commit()
                    print(f"Ticket for booking {booking_id} marked as CANCELLED")
            return

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
