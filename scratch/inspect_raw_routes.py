from sqlalchemy import create_engine, text
import sys
sys.path.append('busgo')
from shared.database_config import get_database_url

def main():
    url = get_database_url(async_driver=False)
    engine = create_engine(url, connect_args={'sslmode': 'require'})
    with engine.connect() as conn:
        print("--- Raw Routes ---")
        routes = conn.execute(text("SELECT id, operator_id, origin_city, destination_city, distance_km FROM routes")).fetchall()
        print(f"Total routes in 'routes' table: {len(routes)}")
        for r in routes:
            print(f"Route ID: {r[0]} | Operator ID: {r[1]} | {r[2]} -> {r[3]} | Distance: {r[4]} km")

if __name__ == '__main__':
    main()
