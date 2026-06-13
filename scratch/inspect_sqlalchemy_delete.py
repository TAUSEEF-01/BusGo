import asyncio
import traceback
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
import sys
sys.path.append('busgo')
sys.path.append('busgo/services/operator-service')
from database import get_db
from models.models import Route
import uuid

async def test_delete():
    DATABASE_URL = "postgresql+asyncpg://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
    engine = create_async_engine(
        DATABASE_URL, 
        connect_args={
            "ssl": "require", 
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4().hex}__",
            "statement_cache_size": 0
        }
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # Find route with trips (Dhaka -> Comilla has 18 trips)
        res = await db.execute(select(Route).where(Route.origin_city == "Dhaka", Route.destination_city == "Comilla"))
        route = res.scalars().first()
        if not route:
            print("No Dhaka -> Comilla route found.")
            return
            
        print(f"Found route ID: {route.id}. Attempting to delete using db.delete(route)...")
        try:
            await db.delete(route)
            await db.commit()
            print("Delete succeeded!")
        except Exception as e:
            print("Delete failed with exception:")
            traceback.print_exc()
            await db.rollback()

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_delete())
