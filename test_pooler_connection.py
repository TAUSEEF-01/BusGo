#!/usr/bin/env python3
"""
Test Supabase Connection Pooler
"""
import asyncio
import sys

async def test_connection():
    try:
        from sqlalchemy.ext.asyncio import create_async_engine
        
        # Test connection pooler with correct format
        DATABASE_URL = "postgresql+asyncpg://postgres:BusGoLet'sGo@db.wtldkwqnfynxfqyqvehy.supabase.co:6543/postgres"
        
        print(f"Testing connection pooler...")
        print(f"URL: {DATABASE_URL.replace('BusGoLet', '***')}")
        
        # For asyncpg, SSL is handled via connect_args
        engine = create_async_engine(
            DATABASE_URL, 
            echo=False,
            connect_args={"ssl": "require"}
        )
        
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
                print("\n⚠️  NO TABLES FOUND!")
                print("You MUST run the SQL script in Supabase:")
                print("1. Go to https://supabase.com/dashboard")
                print("2. Open SQL Editor")
                print("3. Run: busgo/infrastructure/supabase_complete_schema.sql")
            else:
                # List tables
                result = await conn.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                    LIMIT 10
                """)
                tables = [row[0] for row in result.fetchall()]
                print(f"📋 Sample tables: {', '.join(tables)}")
                print(f"\n✅ Database is ready!")
        
        await engine.dispose()
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("SUPABASE CONNECTION POOLER TEST")
    print("=" * 60)
    success = asyncio.run(test_connection())
    print("=" * 60)
    if success:
        print("✅ Connection test PASSED")
        print("\nNext steps:")
        print("1. If tables exist: docker-compose up --build")
        print("2. If no tables: Run supabase_complete_schema.sql first")
    else:
        print("❌ Connection test FAILED")
        print("\nTroubleshooting:")
        print("1. Check your internet connection")
        print("2. Verify Supabase project is active")
        print("3. Check credentials are correct")
    print("=" * 60)
    sys.exit(0 if success else 1)
