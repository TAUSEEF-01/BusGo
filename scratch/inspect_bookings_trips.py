import asyncio
import sys
import uuid
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def inspect():
    DATABASE_URL = "postgresql+asyncpg://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
    
    engine = create_async_engine(
        DATABASE_URL, 
        echo=False, 
        connect_args={
            "ssl": "require", 
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4().hex}__",
            "statement_cache_size": 0
        }
    )
    
    try:
        async with engine.connect() as conn:
            print("=== OPERATORS ===")
            res = await conn.execute(text("SELECT id, name, contact_phone, contact_email FROM operators"))
            operators = res.all()
            for op in operators:
                print(f"ID: {op.id} | Name: {op.name} | Phone: {op.contact_phone} | Email: {op.contact_email}")
            
            print("\n=== BOOKINGS ===")
            res = await conn.execute(text("SELECT id, user_id, trip_id, operator_id, status, total_fare, created_at FROM bookings"))
            bookings = res.all()
            print(f"Total Bookings in DB: {len(bookings)}")
            for b in bookings[:20]:
                print(f"ID: {b.id} | Trip: {b.trip_id} | Operator: {b.operator_id} | Status: {b.status} | Fare: {b.total_fare} | Created: {b.created_at}")
            
            print("\n=== TRIPS ===")
            res = await conn.execute(text("SELECT id, operator_id, status, departure_datetime FROM trips"))
            trips = res.all()
            print(f"Total Trips in DB: {len(trips)}")
            for t in trips[:20]:
                print(f"ID: {t.id} | Operator: {t.operator_id} | Status: {t.status} | Departure: {t.departure_datetime}")

        await engine.dispose()
        return True
    except Exception as e:
        print(f"ERROR: {e}")
        await engine.dispose()
        return False

if __name__ == "__main__":
    asyncio.run(inspect())
