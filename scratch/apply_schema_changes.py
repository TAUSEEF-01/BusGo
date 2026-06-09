import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import uuid

async def apply_changes():
    DATABASE_URL = "postgresql+asyncpg://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
    engine = create_async_engine(
        DATABASE_URL, 
        connect_args={
            "ssl": "require", 
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4().hex}__",
            "statement_cache_size": 0
        }
    )
    
    async with engine.begin() as conn:
        print("Dropping UNIQUE constraint on public.users(phone)...")
        await conn.execute(text("ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_key CASCADE;"))
        print("Dropped UNIQUE constraint successfully.")
        
        print("Ensuring UNIQUE constraint exists on public.users(email)...")
        # Ensure constraint exists by dropping if exists and adding it
        await conn.execute(text("ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key CASCADE;"))
        await conn.execute(text("ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);"))
        print("Enforced UNIQUE constraint on email successfully.")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(apply_changes())
