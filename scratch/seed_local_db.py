import psycopg2
import bcrypt
import uuid

def main():
    db_url = "postgresql://user:password@localhost:18086/postgres"
    print(f"Connecting to local database at {db_url}...")
    
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    try:
        # 1. Clean existing data
        print("Cleaning existing data...")
        cursor.execute("TRUNCATE TABLE users, operators, routes, buses, trips, seat_inventory CASCADE;")
        
        # 2. Seed Operator User
        print("Seeding Operator User...")
        user_id = 'd27c1afc-57c5-4832-92dc-db6e64039aad'
        password = "12345678"
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        cursor.execute(
            """
            INSERT INTO users (id, phone, email, full_name, password_hash, is_verified, role, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
            """,
            (user_id, '12345678', 'oprator1@gmail.com', 'Greenline Paribahan', password_hash, True, 'OPERATOR')
        )
        
        # 3. Seed Operator Profile
        print("Seeding Operator Profile...")
        cursor.execute(
            """
            INSERT INTO operators (id, name, contact_phone, contact_email, address, license_no, commission_rate, is_active, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO NOTHING;
            """,
            (user_id, 'Greenline Paribahan', '12345678', 'oprator1@gmail.com', 'Dhaka', 'GL-1234', 0.10, True)
        )
        
        # 4. Seed Buses
        print("Seeding Buses...")
        bus1_id = str(uuid.uuid4())
        bus2_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO buses (id, operator_id, registration_no, bus_type, total_seats, seat_layout, amenities, is_active, created_at)
            VALUES 
                (%s, %s, %s, %s, %s, %s, %s, %s, NOW()),
                (%s, %s, %s, %s, %s, %s, %s, %s, NOW());
            """,
            (bus1_id, user_id, 'Metro-B-11-2222', 'AC', 40, '{"rows": 10, "cols": 4}', '["AC", "Water", "Wifi"]', True,
             bus2_id, user_id, 'Metro-B-11-3333', 'NON_AC', 40, '{"rows": 10, "cols": 4}', '["Water"]', True)
        )
        
        # 5. Seed Routes
        print("Seeding Routes...")
        route1_id = str(uuid.uuid4())
        route2_id = str(uuid.uuid4())
        
        boarding_points_1 = '[{"name": "Sayedabad", "address": "Sayedabad Bus Terminal", "lat": 23.71, "lng": 90.43}]'
        dropping_points_1 = '[{"name": "Comilla", "address": "Comilla Highway", "lat": 23.46, "lng": 91.18}]'
        
        boarding_points_2 = '[{"name": "Gabtoli", "address": "Gabtoli Bus Terminal", "lat": 23.78, "lng": 90.34}]'
        dropping_points_2 = '[{"name": "Sylhet", "address": "Kadamtali Terminal", "lat": 24.88, "lng": 91.87}]'
        
        cursor.execute(
            """
            INSERT INTO routes (id, operator_id, origin_city, destination_city, distance_km, estimated_duration_hours, boarding_points, dropping_points)
            VALUES 
                (%s, %s, %s, %s, %s, %s, %s, %s),
                (%s, %s, %s, %s, %s, %s, %s, %s);
            """,
            (route1_id, user_id, 'Dhaka', 'Comilla', 100, 2.5, boarding_points_1, dropping_points_1,
             route2_id, user_id, 'Dhaka', 'Sylhet', 240, 5.5, boarding_points_2, dropping_points_2)
        )
        
        # 6. Seed Trips
        print("Seeding Trips...")
        trip1_id = str(uuid.uuid4())
        trip2_id = str(uuid.uuid4())
        
        cursor.execute(
            """
            INSERT INTO trips (id, operator_id, bus_id, route_id, departure_datetime, arrival_datetime, fare_amount, available_seats, status, created_at)
            VALUES 
                (%s, %s, %s, %s, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 3 hours', 800, 40, 'SCHEDULED', NOW()),
                (%s, %s, %s, %s, NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 6 hours', 1200, 40, 'SCHEDULED', NOW());
            """,
            (trip1_id, user_id, bus1_id, route1_id,
             trip2_id, user_id, bus2_id, route2_id)
        )
        
        conn.commit()
        print("Local database successfully seeded with operator, buses, routes, and trips!")
    except Exception as e:
        conn.rollback()
        print(f"Error during seeding: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()
