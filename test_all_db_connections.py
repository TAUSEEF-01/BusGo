import os
import sys
import asyncio
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine

# Add shared to path
sys.path.append('busgo')
from shared.database_config import get_database_url

async def test_service_connection(service_name, async_driver=True):
    url = get_database_url(async_driver=async_driver)
    driver_type = "asyncpg" if async_driver else "psycopg2"
    print(f"Testing {service_name} ({driver_type})...")
    
    try:
        if async_driver:
            import uuid
            engine = create_async_engine(
                url, 
                connect_args={
                    "ssl": "require", 
                    "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4().hex}__",
                    "statement_cache_size": 0
                }
            )
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            await engine.dispose()
        else:
            engine = create_engine(url, connect_args={"sslmode": "require"})
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            engine.dispose()
        print(f"  OK {service_name}")
        return True
    except Exception as e:
        print(f"  FAIL {service_name}: {e}")
        return False

async def main():
    services = [
        ("auth-service", True),
        ("booking-service", True),
        ("search-service", True),
        ("inventory-service", True),
        ("payment-service", True),
        ("operator-service", True),
        ("ticket-service", True),
        ("notification-service", False),
        ("cancellation-service", False),
        ("deals-service", False),
        ("audit-service", False),
        ("admin-service", False),
    ]
    
    results = []
    for svc, is_async in services:
        res = await test_service_connection(svc, is_async)
        results.append(res)
    
    print("\nSummary:")
    if all(results):
        print("All database connections are successful!")
    else:
        print("Some connections failed. Check the output above.")

if __name__ == "__main__":
    asyncio.run(main())
