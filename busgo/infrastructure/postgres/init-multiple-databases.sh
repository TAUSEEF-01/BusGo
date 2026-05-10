#!/bin/bash
set -e

# Define comma separated list of databases
DATABASES="auth_db,search_db,inventory_db,booking_db,payment_db,ticket_db,notification_db,cancellation_db,operator_db,deals_db,admin_db,audit_db"

echo "Creating databases: $DATABASES"

IFS=',' read -ra DB_ARRAY <<< "$DATABASES"
for db in "${DB_ARRAY[@]}"; do
    echo "Creating database: $db"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	    CREATE DATABASE $db;
	    GRANT ALL PRIVILEGES ON DATABASE $db TO "$POSTGRES_USER";
EOSQL
done

echo "Databases created successfully!"
