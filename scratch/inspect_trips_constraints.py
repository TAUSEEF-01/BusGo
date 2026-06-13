import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import uuid

async def inspect_db():
    DATABASE_URL = "postgresql+asyncpg://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
    engine = create_async_engine(
        DATABASE_URL, 
        connect_args={
            "ssl": "require", 
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4().hex}__",
            "statement_cache_size": 0
        }
    )
    
    async with engine.connect() as conn:
        print("Checking constraints on table 'public.trips'...")
        res = await conn.execute(text("""
            SELECT conname, contype, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE t.relname = 'trips' AND n.nspname = 'public';
        """))
        for row in res.fetchall():
            print(f"Constraint: {row}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(inspect_db())
