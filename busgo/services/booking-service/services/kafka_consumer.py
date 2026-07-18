import json
import asyncio
from aiokafka import AIOKafkaConsumer
from sqlalchemy.future import select
from datetime import datetime, timezone
import sys
import os

from core.config import settings
from database import async_session
from models.models import Booking, BookingStatusHistory, Journey
from services.external import ExternalServices
from services.ticket_events import build_ticket_event
from services.travel_records import record_travel

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import BookingStatus
from shared.kafka_producer import KafkaProducerClient

class BookingKafkaConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            "payment.completed", "seat.lock.expired", "payment.failed",
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id="booking-service-group",
            value_deserializer=lambda m: json.loads(m.decode('utf-8-sig'))
        )

    async def start(self):
        await self.consumer.start()
        asyncio.create_task(self.consume())

    async def stop(self):
        await self.consumer.stop()

    async def consume(self):
        # Per-message error handling so one bad message can't kill the consumer.
        async for msg in self.consumer:
            try:
                await self.process_message(msg.topic, msg.value)
            except Exception as e:
                print(f"Error processing {msg.topic} message: {e}")

    async def process_message(self, topic: str, message: dict):
        booking_id = message.get("booking_id")
        if not booking_id: return

        async with async_session() as db:
            query = select(Booking).where(Booking.id == booking_id)
            result = await db.execute(query)
            booking = result.scalars().first()
            if not booking:
                # The id may be a JOURNEY id (payment for a transit journey is
                # recorded against the journey). Resolve it to the journey's legs.
                await self._process_journey_event(db, topic, booking_id, message)
                return

            old_status = booking.status

            if topic == "payment.completed":
                if booking.status == BookingStatus.PAYMENT_PENDING or booking.status == BookingStatus.SEAT_LOCKED:
                    booking.status = BookingStatus.CONFIRMED
                    booking.payment_id = message.get("payment_id")

                    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=booking.status, reason="Payment Completed")
                    db.add(history)
                    await db.commit()

                    if booking.promo_code:
                        await ExternalServices.consume_promo(booking.promo_code, str(booking.user_id))
                    try:
                        await ExternalServices.confirm_seats(
                            str(booking.trip_id), booking.seat_numbers,
                            str(booking.id), str(booking.user_id),
                        )
                    except Exception as e:
                        print(f"Failed to confirm inventory for booking {booking.id}: {e}")

                    # Track the journey in the user's travel record (idempotent).
                    await record_travel(db, booking)

                    await KafkaProducerClient.publish("ticket.issued", await build_ticket_event(booking))

            elif topic == "seat.lock.expired":
                if booking.status == BookingStatus.SEAT_LOCKED:
                    booking.status = BookingStatus.EXPIRED
                    
                    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=booking.status, reason="Seat Lock Expired via Kafka")
                    db.add(history)
                    await db.commit()
                    
                    await KafkaProducerClient.publish("audit.log", {
                        "event": "booking.expired", "booking_id": str(booking.id), "timestamp": datetime.now(timezone.utc).isoformat()
                    })

            elif topic == "payment.failed":
                # Payment definitively failed → the held seats have been released
                # by inventory, so this booking is dead. Mark it terminal (only if
                # it never got confirmed) so it can't be paid for later.
                if booking.status in (BookingStatus.SEAT_LOCKED, BookingStatus.PAYMENT_PENDING):
                    booking.status = BookingStatus.EXPIRED
                    history = BookingStatusHistory(booking_id=booking.id, from_status=old_status, to_status=BookingStatus.EXPIRED, reason=f"Payment failed ({message.get('reason', 'unknown')}) - seats released")
                    db.add(history)
                    await db.commit()
                    await KafkaProducerClient.publish("audit.log", {
                        "event": "booking.payment_failed", "booking_id": str(booking.id), "timestamp": datetime.now(timezone.utc).isoformat()
                    })

    async def _process_journey_event(self, db, topic: str, journey_id: str, message: dict):
        """Handle an event whose id refers to a transit Journey (not a Booking).
        On payment.failed, expire the journey + all its legs and release each
        leg's seats via seat.lock.expired (inventory already handles that)."""
        journey = (await db.execute(select(Journey).where(Journey.id == journey_id))).scalars().first()
        if not journey:
            return
        if topic == "payment.completed":
            if journey.status not in (BookingStatus.SEAT_LOCKED, BookingStatus.PAYMENT_PENDING):
                return
            journey.status = BookingStatus.CONFIRMED
            journey.payment_id = message.get("payment_id")
            legs = (await db.execute(
                select(Booking).where(Booking.journey_id == journey.id).order_by(Booking.leg_number)
            )).scalars().all()
            for leg in legs:
                previous = leg.status
                leg.status = BookingStatus.CONFIRMED
                leg.payment_id = message.get("payment_id")
                db.add(BookingStatusHistory(
                    booking_id=leg.id, from_status=previous,
                    to_status=BookingStatus.CONFIRMED,
                    reason="Journey payment completed",
                ))
            await db.commit()

            if journey.promo_code:
                await ExternalServices.consume_promo(journey.promo_code, str(journey.user_id))
            for leg in legs:
                try:
                    await ExternalServices.confirm_seats(
                        str(leg.trip_id), leg.seat_numbers,
                        str(leg.id), str(leg.user_id),
                    )
                except Exception as e:
                    print(f"Failed to confirm inventory for journey leg {leg.id}: {e}")
                await record_travel(db, leg)
                await KafkaProducerClient.publish("ticket.issued", await build_ticket_event(leg))
            return

        if topic != "payment.failed" or journey.status not in (
            BookingStatus.SEAT_LOCKED, BookingStatus.PAYMENT_PENDING
        ):
            return

        journey.status = BookingStatus.EXPIRED
        legs = (await db.execute(select(Booking).where(Booking.journey_id == journey.id))).scalars().all()
        expired_legs = []
        for leg in legs:
            if leg.status in (BookingStatus.SEAT_LOCKED, BookingStatus.PAYMENT_PENDING):
                prev = leg.status
                leg.status = BookingStatus.EXPIRED
                db.add(BookingStatusHistory(booking_id=leg.id, from_status=prev, to_status=BookingStatus.EXPIRED, reason=f"Journey payment failed ({message.get('reason', 'unknown')})"))
                expired_legs.append(leg)
        await db.commit()

        for leg in expired_legs:
            await KafkaProducerClient.publish("seat.lock.expired", {
                "booking_id": str(leg.id), "trip_id": str(leg.trip_id), "seat_numbers": leg.seat_numbers,
            })
        await KafkaProducerClient.publish("audit.log", {
            "event": "journey.payment_failed", "journey_id": str(journey.id), "timestamp": datetime.now(timezone.utc).isoformat(),
        })
