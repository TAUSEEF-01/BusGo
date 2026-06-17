import psycopg2
import uuid
import json
from datetime import date, timedelta

def main():
    db_url = "postgresql://user:password@localhost:18086/postgres"
    print(f"Connecting to database at {db_url}...")
    
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    try:
        # 1. Fetch operator user_id
        cursor.execute("SELECT id FROM operators LIMIT 1;")
        row = cursor.fetchone()
        if not row:
            print("No operator found. Please run seed_local_db.py first.")
            return
        operator_id = row[0]
        print(f"Using operator ID: {operator_id}")

        # 2. Fetch buses
        cursor.execute("SELECT id, bus_type FROM buses WHERE operator_id = %s;", (operator_id,))
        buses = cursor.fetchall()
        if not buses:
            print("No buses found.")
            return
        bus_ac = [b[0] for b in buses if b[1] == 'AC'][0]
        bus_nonac = [b[0] for b in buses if b[1] == 'NON_AC'][0]
        print(f"Buses: AC={bus_ac}, NON_AC={bus_nonac}")

        # 3. Create reverse routes
        # Dhaka -> Comilla reverse is Comilla -> Dhaka
        boarding_points_comilla = '[{"name": "Comilla", "address": "Comilla Highway", "lat": 23.46, "lng": 91.18}]'
        dropping_points_dhaka = '[{"name": "Sayedabad", "address": "Sayedabad Bus Terminal", "lat": 23.71, "lng": 90.43}]'
        
        # Dhaka -> Sylhet reverse is Sylhet -> Dhaka
        boarding_points_sylhet = '[{"name": "Kadamtali", "address": "Kadamtali Terminal", "lat": 24.88, "lng": 91.87}]'
        dropping_points_dhaka_gabtoli = '[{"name": "Gabtoli", "address": "Gabtoli Bus Terminal", "lat": 23.78, "lng": 90.34}]'

        routes_to_add = [
            ('Comilla', 'Dhaka', 100, 2.5, boarding_points_comilla, dropping_points_dhaka),
            ('Sylhet', 'Dhaka', 240, 5.5, boarding_points_sylhet, dropping_points_dhaka_gabtoli)
        ]

        added_routes = {}
        for origin, dest, dist, dur, bp, dp in routes_to_add:
            cursor.execute(
                "SELECT id FROM routes WHERE origin_city = %s AND destination_city = %s AND operator_id = %s;",
                (origin, dest, operator_id)
            )
            exists = cursor.fetchone()
            if exists:
                route_id = exists[0]
                print(f"Route {origin} -> {dest} already exists (ID: {route_id})")
            else:
                route_id = str(uuid.uuid4())
                cursor.execute(
                    """
                    INSERT INTO routes (id, operator_id, origin_city, destination_city, distance_km, estimated_duration_hours, boarding_points, dropping_points)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                    """,
                    (route_id, operator_id, origin, dest, dist, dur, bp, dp)
                )
                print(f"Added route {origin} -> {dest} (ID: {route_id})")
            added_routes[f"{origin}->{dest}"] = route_id

        # Also get existing forward routes
        cursor.execute("SELECT origin_city, destination_city, id FROM routes;")
        all_rows = cursor.fetchall()
        for origin, dest, r_id in all_rows:
            added_routes[f"{origin}->{dest}"] = r_id

        # 4. Add trips for next 14 days in both directions
        print("Seeding forward and return trips for next 14 days...")
        trips_count = 0
        today = date.today()
        for day in range(0, 14):
            trip_date = today + timedelta(days=day)
            for direction, r_id in added_routes.items():
                is_ac = "Comilla" in direction or day % 2 == 0
                bus_id = bus_ac if is_ac else bus_nonac
                fare = 850 if is_ac else 600

                # We'll seed trips at 08:00 AM, 02:00 PM, and 08:00 PM
                times = ["08:00:00", "14:00:00", "20:00:00"]
                for t in times:
                    dep_dt = f"{trip_date} {t}"
                    arr_dt = f"{trip_date} {t}"  # simple fallback
                    
                    # Check duplication
                    cursor.execute(
                        "SELECT id FROM trips WHERE route_id = %s AND departure_datetime = %s;",
                        (r_id, dep_dt)
                    )
                    if not cursor.fetchone():
                        trip_id = str(uuid.uuid4())
                        cursor.execute(
                            """
                            INSERT INTO trips (id, operator_id, bus_id, route_id, departure_datetime, arrival_datetime, fare_amount, available_seats, status, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, 40, 'SCHEDULED', NOW());
                            """,
                            (trip_id, operator_id, bus_id, r_id, dep_dt, arr_dt, fare)
                        )
                        trips_count += 1

        conn.commit()
        print(f"Seeding completed successfully! Added {trips_count} new trips.")

    except Exception as e:
        conn.rollback()
        print(f"Error during seeding return trips: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()
