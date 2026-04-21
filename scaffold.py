import os

services = [
    ('auth-service', 8001), ('search-service', 8002), ('inventory-service', 8003),
    ('booking-service', 8004), ('payment-service', 8005), ('ticket-service', 8006),
    ('notification-service', 8007), ('cancellation-service', 8008), ('operator-service', 8009),
    ('deals-service', 8010), ('admin-service', 8011), ('audit-service', 8012)
]

base_dir = 'busgo'
os.makedirs(f'{base_dir}/services', exist_ok=True)
os.makedirs(f'{base_dir}/frontend', exist_ok=True)
os.makedirs(f'{base_dir}/infrastructure/postgres', exist_ok=True)
os.makedirs(f'{base_dir}/infrastructure/kafka', exist_ok=True)
os.makedirs(f'{base_dir}/infrastructure/kong', exist_ok=True)
os.makedirs(f'{base_dir}/shared', exist_ok=True)

# Shared
shared_files = {
    '__init__.py': '',
    'base_response.py': '''from typing import Any, Generic, TypeVar, Optional, List
from pydantic import BaseModel

T = TypeVar('T')

class BaseResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    message: str = ''
    errors: Optional[List[str]] = None
''',
    'enums.py': '''from enum import Enum

class BookingStatus(str, Enum):
    INITIATED = 'INITIATED'
    SEAT_LOCKED = 'SEAT_LOCKED'
    PAYMENT_PENDING = 'PAYMENT_PENDING'
    CONFIRMED = 'CONFIRMED'
    CANCELLED = 'CANCELLED'
    REFUNDED = 'REFUNDED'
    EXPIRED = 'EXPIRED'

class PaymentMethod(str, Enum):
    BKASH = 'BKASH'
    NAGAD = 'NAGAD'
    CARD = 'CARD'
    INTERNET_BANKING = 'INTERNET_BANKING'

class UserRole(str, Enum):
    CUSTOMER = 'CUSTOMER'
    OPERATOR = 'OPERATOR'
    ADMIN = 'ADMIN'

class TicketStatus(str, Enum):
    ACTIVE = 'ACTIVE'
    USED = 'USED'
    CANCELLED = 'CANCELLED'
    EXPIRED = 'EXPIRED'
''',
    'exceptions.py': '''class BaseCustomException(Exception):
    pass

class BookingNotFound(BaseCustomException):
    pass

class SeatAlreadyLocked(BaseCustomException):
    pass

class PaymentFailed(BaseCustomException):
    pass

class UnauthorizedAccess(BaseCustomException):
    pass
''',
    'kafka_producer.py': '''import json
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
''',
    'kafka_consumer.py': '''import json
from aiokafka import AIOKafkaConsumer
import os

KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')

class KafkaConsumerBase:
    def __init__(self, topic: str, group_id: str):
        self.topic = topic
        self.group_id = group_id
        self.consumer = AIOKafkaConsumer(
            self.topic,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id=self.group_id,
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )

    async def start(self):
        await self.consumer.start()

    async def stop(self):
        await self.consumer.stop()

    async def consume(self):
        async for msg in self.consumer:
            await self.process_message(msg.value)

    async def process_message(self, message: dict):
        raise NotImplementedError('Must be implemented in subclass')
'''
}

for fname, content in shared_files.items():
    with open(os.path.join(base_dir, 'shared', fname), 'w') as f:
        f.write(content.strip() + '\\n')

for svc, port in services:
    sdir = os.path.join(base_dir, 'services', svc)
    os.makedirs(os.path.join(sdir, 'routers'), exist_ok=True)
    os.makedirs(os.path.join(sdir, 'models'), exist_ok=True)
    os.makedirs(os.path.join(sdir, 'schemas'), exist_ok=True)
    os.makedirs(os.path.join(sdir, 'services'), exist_ok=True)
    
    with open(os.path.join(sdir, 'main.py'), 'w') as f:
        f.write(f'''from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="{svc}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.get("/")
async def root():
    return {{"message": "{svc} is running on port {port}"}}
'''.strip() + '\n')

    with open(os.path.join(sdir, 'database.py'), 'w') as f:
        db_name = svc.split('-')[0] + '_db'
        f.write(f'''from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", f"postgresql+asyncpg://postgres:postgres@localhost:5432/{db_name}")
engine = create_async_engine(DATABASE_URL, echo=True)
async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_db():
    async with async_session() as session:
        yield session
'''.strip() + '\n')

    with open(os.path.join(sdir, 'Dockerfile'), 'w') as f:
        f.write('''FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
'''.strip() + '\n')

    with open(os.path.join(sdir, 'requirements.txt'), 'w') as f:
        f.write('''fastapi
uvicorn
sqlalchemy[asyncio]
asyncpg
pydantic
pydantic-settings
python-dotenv
alembic
aiokafka
python-jose[cryptography]
'''.strip() + '\n')

    with open(os.path.join(sdir, '.env.example'), 'w') as f:
        db_name = svc.split('-')[0] + '_db'
        f.write(f'DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/{db_name}\nKAFKA_BOOTSTRAP_SERVERS=kafka:9092\n')
