#!/usr/bin/env python3
"""
Test Supabase PostgreSQL connection
"""
import asyncio
import sys

async def test_connection():
    try:
        from sqlalchemy.ext.asyncio import create_async_engine
        
        # Test connection
        DATABASE_URL = "postgresql+asyncpg://postgres:BusGoLet'sGo@db.wtldkwqnfynxfqyqvehy.supabase.co:5432/postgres"
        
        print(f"Testing connection to: {DATABASE_URL.replace('BusGoLet', '***')}")
        
        engine = create_async_engine(DATABASE_URL, echo=False)
        
        async with engine.connect() as conn:
            result = await conn.execute("SELECT version();")
            version = result.scalar()
            print(f"✅ Connection successful!")
            print(f"PostgreSQL version: {version}")
            
            # Test if tables exist
            result = await conn.execute("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
            """)
            table_count = result.scalar()
            print(f"📊 Tables in public schema: {table_count}")
            
            if table_count == 0:
                print("⚠️  No tables found! You need to run supabase_complete_schema.sql")
            else:
                # List tables
                result = await conn.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                """)
                tables = [row[0] for row in result.fetchall()]
                print(f"📋 Tables: {', '.join(tables)}")
        
        await engine.dispose()
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print(f"Error type: {type(e).__name__}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)
