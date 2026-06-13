from sqlalchemy import create_engine, text
import sys
sys.path.append('busgo')
from shared.database_config import get_database_url

def main():
    url = get_database_url(async_driver=False)
    print("Database URL used locally:", url)
    engine = create_engine(url, connect_args={'sslmode': 'require'})
    with engine.connect() as conn:
        print("--- All Operators ---")
        operators = conn.execute(text("SELECT id, name, contact_email FROM operators")).fetchall()
        for op in operators:
            print(f"Operator: ID={op[0]}, Name={op[1]}, Email={op[2]}")
            
        print("\n--- All Routes & Trip Counts ---")
        routes = conn.execute(text("SELECT r.id, r.operator_id, r.origin_city, r.destination_city, o.name, o.contact_email FROM routes r JOIN operators o ON r.operator_id = o.id")).fetchall()
        for r in routes:
            trips_count = conn.execute(text("SELECT COUNT(1) FROM trips WHERE route_id=:rid"), {'rid': r[0]}).scalar()
            print(f"Route ID: {r[0]} | Operator: {r[4]} ({r[5]}) | {r[2]} -> {r[3]} | Trips: {trips_count}")

if __name__ == '__main__':
    main()
