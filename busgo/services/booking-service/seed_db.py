import asyncio
import uuid
import sys
import os
from datetime import datetime, timezone, timedelta

# Append the project root so shared and models can be imported
sys.path.append(os.path.dirname(__file__))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text

from database import async_session
from models.models import Booking, BookingStatusHistory
from shared.enums import BookingStatus

# We need the user UUID. In auth_db, user 'abc' exists. But we can't easily query auth_db from booking-service without a separate engine.
# Wait! Let's just query auth_db using a direct connection, get the user, and then create bookings in booking_db.
# Or better, just hardcode the user_id if we know it?
# Let's write code to connect to auth_db directly.

import asyncpg

async def get_user_id(email: str = "abc@example.com", username: str = "abc"):
    # Connect to auth_db
    conn = await asyncpg.connect('postgresql://user:password@postgres:5432/auth_db')
    row = await conn.fetchrow('SELECT id FROM users WHERE email = $1 LIMIT 1', email)
    await conn.close()
    if row:
        return row['id']
    return None

async def seed():
    print("Starting database seed...")
    user_id = uuid.UUID('12345678-1234-5678-1234-567812345678')
    
    # Operators mapping for frontend
    operator_id_1 = uuid.uuid4() # Greenline
    operator_id_2 = uuid.uuid4() # Hanif
    
    bookings_data = [
        {
            "id": uuid.uuid4(),
            "user_id": user_id,
            "trip_id": uuid.uuid4(),
            "operator_id": operator_id_1,
            "seat_numbers": ["A3", "A4"],
            "passenger_details": [{"name": "abc", "age": 30, "gender": "Male", "seat": "A3"}],
            "boarding_point": "Dhaka",
            "dropping_point": "Chittagong",
            "journey_date": (datetime.now() + timedelta(days=5)).date(),
            "departure_time": datetime.strptime("08:00:00", "%H:%M:%S").time(),
            "total_fare": 1720.00,
            "status": BookingStatus.CONFIRMED,
            "idempotency_key": "seed-idemp-1",
            "expires_at": datetime.now(timezone.utc) + timedelta(days=5)
        },
        {
            "id": uuid.uuid4(),
            "user_id": user_id,
            "trip_id": uuid.uuid4(),
            "operator_id": operator_id_2,
            "seat_numbers": ["C2"],
            "passenger_details": [{"name": "abc", "age": 30, "gender": "Male", "seat": "C2"}],
            "boarding_point": "Dhaka",
            "dropping_point": "Sylhet",
            "journey_date": (datetime.now() + timedelta(days=10)).date(),
            "departure_time": datetime.strptime("10:00:00", "%H:%M:%S").time(),
            "total_fare": 750.00,
            "status": BookingStatus.CONFIRMED,
            "idempotency_key": "seed-idemp-2",
            "expires_at": datetime.now(timezone.utc) + timedelta(days=10)
        },
        {
            "id": uuid.uuid4(),
            "user_id": user_id,
            "trip_id": uuid.uuid4(),
            "operator_id": operator_id_1,
            "seat_numbers": ["B1", "B2"],
            "passenger_details": [{"name": "abc", "age": 30, "gender": "Male", "seat": "B1"}],
            "boarding_point": "Dhaka",
            "dropping_point": "Cox's Bazar",
            "journey_date": (datetime.now() - timedelta(days=10)).date(),
            "departure_time": datetime.strptime("09:00:00", "%H:%M:%S").time(),
            "total_fare": 2440.00,
            "status": BookingStatus.CONFIRMED,
            "idempotency_key": "seed-idemp-3",
            "expires_at": datetime.now(timezone.utc)
        },
        {
            "id": uuid.uuid4(),
            "user_id": user_id,
            "trip_id": uuid.uuid4(),
            "operator_id": operator_id_2,
            "seat_numbers": ["E1"],
            "passenger_details": [{"name": "abc", "age": 30, "gender": "Male", "seat": "E1"}],
            "boarding_point": "Dhaka",
            "dropping_point": "Khulna",
            "journey_date": (datetime.now() - timedelta(days=2)).date(),
            "departure_time": datetime.strptime("06:00:00", "%H:%M:%S").time(),
            "total_fare": 780.00,
            "status": BookingStatus.CANCELLED,
            "idempotency_key": "seed-idemp-4",
            "expires_at": datetime.now(timezone.utc)
        }
    ]

    async with async_session() as db:
        # Clear existing bookings for this user to avoid duplicates if run multiple times
        await db.execute(text(f"DELETE FROM booking_status_history WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = '{user_id}')"))
        await db.execute(text(f"DELETE FROM bookings WHERE user_id = '{user_id}'"))
        
        for data in bookings_data:
            booking = Booking(**data)
            db.add(booking)
            history = BookingStatusHistory(
                booking_id=booking.id, 
                from_status=BookingStatus.INITIATED, 
                to_status=booking.status, 
                reason="Seed Data"
            )
            db.add(history)
            
        await db.commit()
        print(f"Successfully seeded {len(bookings_data)} bookings for user {user_id}")

if __name__ == "__main__":
    asyncio.run(seed())
