import json
from aiokafka import AIOKafkaProducer
import os

KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')

class KafkaProducerClient:
    _producer = None

    @classmethod
    async def get_producer(cls):
        if cls._producer is None:
            cls._producer = AIOKafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            await cls._producer.start()
        return cls._producer

    @classmethod
    async def publish(cls, topic: str, event: dict):
        producer = await cls.get_producer()
        await producer.send_and_wait(topic, event)

    @classmethod
    async def stop(cls):
        if cls._producer:
            await cls._producer.stop()
