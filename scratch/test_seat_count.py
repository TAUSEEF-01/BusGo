import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import uuid

async def test_query():
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
            print("--- Testing list_trips query ---")
            counts_res = await conn.execute(
                text("""
                    SELECT 
                        trip_id,
                        COUNT(*) FILTER (WHERE status = 'AVAILABLE') as avail_count,
                        COUNT(*) as total_inv_count
                    FROM seat_inventory
                    GROUP BY trip_id
                """)
            )
            rows = counts_res.all()
            print(f"Query returned {len(rows)} trip inventories:")
            for row in rows:
                print(f"Trip ID: {row.trip_id} | Available: {row.avail_count} / Total: {row.total_inv_count}")
                
            print("\n--- Testing single trip query ---")
            if rows:
                target_trip_id = rows[0].trip_id
                counts_res = await conn.execute(
                    text("""
                        SELECT 
                            COUNT(*) FILTER (WHERE status = 'AVAILABLE') as avail_count,
                            COUNT(*) as total_inv_count
                        FROM seat_inventory
                        WHERE trip_id = :trip_id
                    """),
                    {"trip_id": target_trip_id}
                )
                counts_row = counts_res.first()
                print(f"Single Trip ID: {target_trip_id} | Available: {counts_row.avail_count} / Total: {counts_row.total_inv_count}")
            else:
                print("No trip inventories to test single trip query.")
                
        await engine.dispose()
        return True
    except Exception as e:
        print(f"ERROR: Query failed: {e}")
        await engine.dispose()
        return False

if __name__ == "__main__":
    asyncio.run(test_query())
