import asyncio
from sqlalchemy import create_engine, text
import sys
sys.path.append('busgo')
from shared.database_config import get_database_url

def main():
    url = get_database_url(async_driver=False)
    engine = create_engine(url, connect_args={'sslmode': 'require'})
    with engine.connect() as conn:
        op_id = 'd27c1afc-57c5-4832-92dc-db6e64039aad'
        routes = conn.execute(text("SELECT id, origin_city, destination_city FROM routes WHERE operator_id=:id"), {'id': op_id}).fetchall()
        print('Routes for Greenline Paribahan:')
        for r in routes:
            trips_count = conn.execute(text("SELECT COUNT(1) FROM trips WHERE route_id=:rid"), {'rid': r[0]}).scalar()
            print(f'  Route ID: {r[0]} | {r[1]} -> {r[2]} | Trips count: {trips_count}')

if __name__ == '__main__':
    main()
