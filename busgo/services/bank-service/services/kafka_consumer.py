import json
import asyncio
import sys
import os
from aiokafka import AIOKafkaConsumer

from core.config import settings
from database import async_session
from services.provisioning import provision_accounts

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))


class BankKafkaConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            "audit.log",
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id="bank-service-group",
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
            print(f"Bank consumer error: {e}")

    async def process_message(self, topic: str, message: dict):
        # auth-service publishes user.registered as an audit.log event.
        if message.get("event") != "user.registered":
            return
        user_id = message.get("user_id")
        phone = message.get("phone")
        if not user_id:
            return
        try:
            async with async_session() as db:
                accounts = await provision_accounts(db, user_id, phone)
                print(f"Provisioned {len(accounts)} bank accounts for user {user_id}")
        except Exception as e:
            print(f"Failed to provision accounts for {user_id}: {e}")
