#!/usr/bin/env python3
"""
Test Supabase PostgreSQL connection
"""
import asyncio
import sys

async def test_connection():
    try:
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlalchemy import text
        
        # Test connection using Supabase connection pooler (supports IPv4)
        DATABASE_URL = "postgresql+asyncpg://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
        
        print(f"Testing connection to: {DATABASE_URL.replace('BusGoLet', '***')}")
        
        import uuid
        engine = create_async_engine(
            DATABASE_URL, 
            echo=False, 
            connect_args={
                "ssl": "require", 
                "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4().hex}__",
                "statement_cache_size": 0
            }
        )
        
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            val = result.scalar()
            print(f"SUCCESS: Connection successful! Result: {val}")
        
        await engine.dispose()
        return True
        
    except Exception as e:
        print(f"ERROR: Connection failed: {e}")
        print(f"Error type: {type(e).__name__}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)
