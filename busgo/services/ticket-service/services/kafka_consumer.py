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
from services.qr_generator import QRGenerator
from services.pdf_generator import PDFGenerator
from services.artifact_storage import ArtifactStorage

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import TicketStatus
from shared.kafka_producer import KafkaProducerClient

class TicketKafkaConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            "ticket.issued",
            "booking.cancelled",
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
        async for msg in self.consumer:
            try:
                await self.process_message(msg.topic, msg.value)
            except Exception as e:
                print(f"Error processing {msg.topic} message: {e}")

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
            
            # Booking events carry everything needed to issue a ticket. Never
            # fabricate ticket ownership or journey data when an event is bad.
            booking_data = message.get("booking")
            if not booking_data:
                print(f"Ticket {booking_id} skipped: booking details are unavailable")
                return

            # 1. Generate unique QR Token
            qr_token = self.generate_token(booking_id)
            
            # 2. Generate QR code image
            qr_bytes = QRGenerator.generate_qr(qr_token)
            
            # 3. Generate PDF
            pdf_bytes = PDFGenerator.generate_ticket_pdf(booking_data, qr_bytes)
            
            # 4. Persist artifacts on the ticket-service volume. Public file
            # links contain the signed QR token and are validated by the API.
            await ArtifactStorage.save(qr_bytes, f"{booking_id}.png")
            await ArtifactStorage.save(pdf_bytes, f"{booking_id}.pdf")
            qr_url = f"/api/tickets/files/{booking_id}/qr?token={qr_token}"
            pdf_url = f"/api/tickets/files/{booking_id}/pdf?token={qr_token}"
            
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
