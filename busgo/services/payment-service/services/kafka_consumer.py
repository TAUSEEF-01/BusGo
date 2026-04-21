import json
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
