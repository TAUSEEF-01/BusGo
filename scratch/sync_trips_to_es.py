import psycopg2
import urllib.request
import json

def main():
    db_url = "postgresql://user:password@localhost:18086/postgres"
    es_base_url = "http://localhost:9200"
    
    print(f"Connecting to database at {db_url}...")
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    try:
        # Check ES connection and create index if not exists
        print(f"Checking Elasticsearch at {es_base_url}...")
        try:
            req = urllib.request.Request(f"{es_base_url}/bus_trips", method="HEAD")
            with urllib.request.urlopen(req) as response:
                index_exists = True
        except Exception:
            index_exists = False
            
        if not index_exists:
            print("Creating Elasticsearch index 'bus_trips'...")
            mapping = {
                "mappings": {
                    "properties": {
                        "trip_id": {"type": "keyword"},
                        "operator_id": {"type": "keyword"},
                        "operator_name": {"type": "text"},
                        "bus_type": {"type": "keyword"},
                        "origin_city": {"type": "keyword"},
                        "destination_city": {"type": "keyword"},
                        "departure_datetime": {"type": "date"},
                        "arrival_datetime": {"type": "date"},
                        "fare_amount": {"type": "double"},
                        "available_seats": {"type": "integer"},
                        "status": {"type": "keyword"}
                    }
                }
            }
            req = urllib.request.Request(
                f"{es_base_url}/bus_trips",
                data=json.dumps(mapping).encode('utf-8'),
                headers={"Content-Type": "application/json"},
                method="PUT"
            )
            with urllib.request.urlopen(req) as response:
                print("Index created successfully.")

        # Query all trips with operator details
        query = """
        SELECT 
            t.id as trip_id,
            t.operator_id,
            o.name as operator_name,
            b.bus_type,
            r.origin_city,
            r.destination_city,
            t.departure_datetime,
            t.arrival_datetime,
            t.fare_amount,
            t.available_seats,
            t.status
        FROM trips t
        JOIN routes r ON t.route_id = r.id
        JOIN buses b ON t.bus_id = b.id
        JOIN operators o ON t.operator_id = o.id;
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        print(f"Retrieved {len(rows)} trips from PostgreSQL. Syncing to Elasticsearch...")
        
        synced_count = 0
        for row in rows:
            trip_id = row[0]
            trip_doc = {
                "trip_id": trip_id,
                "operator_id": row[1],
                "operator_name": row[2],
                "bus_type": row[3],
                "origin_city": row[4],
                "destination_city": row[5],
                "departure_datetime": row[6].isoformat(),
                "arrival_datetime": row[7].isoformat(),
                "fare_amount": float(row[8]),
                "available_seats": int(row[9]),
                "status": row[10]
            }
            
            # Index document
            req = urllib.request.Request(
                f"{es_base_url}/bus_trips/_doc/{trip_id}",
                data=json.dumps(trip_doc).encode('utf-8'),
                headers={"Content-Type": "application/json"},
                method="PUT"
            )
            with urllib.request.urlopen(req) as response:
                res_body = json.loads(response.read().decode())
                if res_body.get('result') in ('created', 'updated'):
                    synced_count += 1
                    
        print(f"Sync complete! Indexed {synced_count} trips in Elasticsearch.")
        
    except Exception as e:
        print(f"Error during sync: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()
