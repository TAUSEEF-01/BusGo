# BusGo Database Table Structures & Modification Guide

BusGo uses **SQLAlchemy** to manage its database tables across all microservices. The actual "table creation commands" are the Python class definitions located in the `models.py` files of each service. 

To change the structure of any table, **you must modify the Python files listed below**. Do not try to modify the database using raw SQL scripts, as that will cause the Python backend ORM to break.

Here is the complete structure of all tables and the file paths you need to modify.

---

## 1. Auth Service (`auth_db`)
**File to modify:** `e:\My_Github_Projects\Jaabo\busgo\services\auth-service\models\user.py`

### `users` table
- `id` (UUID, Primary Key)
- `phone` (String, Unique)
- `email` (String)
- `full_name` (String)
- `password_hash` (String)
- `role` (Enum: CUSTOMER, ADMIN, OPERATOR)
- `is_verified` (Boolean)
- `is_active` (Boolean)
- `created_at` (DateTime)
- `updated_at` (DateTime)

### `otp_records` table
- `id` (UUID, Primary Key)
- `phone` (String)
- `otp_code` (String)
- `expires_at` (DateTime)
- `is_used` (Boolean)

### `refresh_tokens` table
- `id` (UUID, Primary Key)
- `user_id` (UUID, ForeignKey to users.id)
- `token` (String, Unique)
- `expires_at` (DateTime)
- `is_revoked` (Boolean)

---

## 2. Booking Service (`booking_db`)
**File to modify:** `e:\My_Github_Projects\Jaabo\busgo\services\booking-service\models\models.py`

### `bookings` table
- `id` (UUID, Primary Key)
- `user_id` (UUID)
- `trip_id` (UUID)
- `operator_id` (UUID)
- `seat_numbers` (JSONB)
- `passenger_details` (JSONB)
- `boarding_point` (String)
- `dropping_point` (String)
- `journey_date` (Date)
- `departure_time` (Time)
- `total_fare` (Numeric)
- `discount_amount` (Numeric)
- `promo_code` (String)
- `status` (Enum: INITIATED, etc.)
- `idempotency_key` (String, Unique)
- `payment_id` (UUID)
- `created_at` / `updated_at` / `expires_at` (DateTime)

### `booking_status_history` table
- `id` (UUID, Primary Key)
- `booking_id` (UUID, ForeignKey)
- `from_status` / `to_status` (Enum)
- `changed_at` (DateTime)
- `reason` (String)

---

## 3. Cancellation Service (`cancellation_db`)
**File to modify:** `e:\My_Github_Projects\Jaabo\busgo\services\cancellation-service\models\cancellation.py`

### `cancellation_requests` table
- `id` (UUID, Primary Key)
- `booking_id` (UUID)
- `user_id` (UUID)
- `reason` (String)
- `requested_at` (DateTime)
- `status` (Enum: PENDING, APPROVED, REJECTED)
- `rejection_reason` (String)
- `refund_amount` (Numeric)
- `processed_at` (DateTime)

---

## 4. Inventory Service (`inventory_db`)
**File to modify:** `e:\My_Github_Projects\Jaabo\busgo\services\inventory-service\models\models.py`

### `seat_inventory` table
- `id` (UUID, Primary Key)
- `trip_id` (UUID)
- `seat_number` (String)
- `seat_type` (Enum: WINDOW, AISLE, SLEEPER_UPPER, SLEEPER_LOWER)
- `status` (Enum: AVAILABLE, LOCKED, BOOKED)
- `locked_by_booking_id` (UUID)
- `lock_expires_at` (DateTime)
- `booked_by_user_id` (UUID)

---

## 5. Operator Service (`operator_db`)
**File to modify:** `e:\My_Github_Projects\Jaabo\busgo\services\operator-service\models\models.py`

### `operators` table
- `id` (UUID, Primary Key)
- `name` / `contact_phone` / `contact_email` / `address` / `license_no` (String)
- `commission_rate` (Float)
- `is_active` (Boolean)
- `created_at` (DateTime)

### `buses` table
- `id` (UUID, Primary Key)
- `operator_id` (UUID, ForeignKey)
- `registration_no` (String, Unique)
- `bus_type` (Enum: AC, NON_AC, SLEEPER)
- `total_seats` (Integer)
- `seat_layout` / `amenities` (JSONB)
- `is_active` (Boolean)

### `routes` table
- `id` (UUID, Primary Key)
- `operator_id` (UUID, ForeignKey)
- `origin_city` / `destination_city` (String)
- `distance_km` / `estimated_duration_hours` (Float)
- `boarding_points` / `dropping_points` (JSONB)

### `trips` table
- `id` (UUID, Primary Key)
- `operator_id` / `bus_id` / `route_id` (UUID, ForeignKeys)
- `departure_datetime` / `arrival_datetime` (DateTime)
- `fare_amount` (Numeric)
- `available_seats` (Integer)
- `status` (Enum: SCHEDULED, CANCELLED, COMPLETED)
- `created_at` (DateTime)

---

## 6. Payment Service (`payment_db`)
**File to modify:** `e:\My_Github_Projects\Jaabo\busgo\services\payment-service\models\models.py`

### `payments` table
- `id` (UUID, Primary Key)
- `booking_id` / `user_id` / `trip_id` (UUID)
- `amount` (Numeric)
- `method` (Enum)
- `gateway_transaction_id` (String, Unique)
- `status` (Enum)
- `gateway_response` (JSONB)
- `initiated_at` / `completed_at` (DateTime)

### `refunds` table
- `id` (UUID, Primary Key)
- `payment_id` (UUID, ForeignKey)
- `booking_id` (UUID)
- `amount` (Numeric)
- `reason` (String)
- `status` (Enum)
- `gateway_refund_id` (String)
- `initiated_at` / `completed_at` (DateTime)
- `estimated_days` (Integer)

---

## 7. Ticket Service (`ticket_db`)
**File to modify:** `e:\My_Github_Projects\Jaabo\busgo\services\ticket-service\models\models.py`

### `tickets` table
- `id` (UUID, Primary Key)
- `booking_id` (UUID, Unique)
- `user_id` / `trip_id` (UUID)
- `seat_numbers` / `passenger_details` (JSONB)
- `qr_code_data` (String, Unique)
- `qr_code_url` / `pdf_url` (String)
- `status` (Enum)
- `issued_at` / `used_at` / `expires_at` (DateTime)

---

## How to Modify a Table

1. Open the corresponding `.py` file for the service (listed above).
2. Add, remove, or modify a `Column` definition. 
   *(Example: To add an address to the User, open `auth-service/models/user.py` and add `address = Column(String, nullable=True)`)*
3. Save the file.
4. Because the app uses `Base.metadata.create_all()` on startup (which creates tables but does not alter existing ones), you must wipe the database volume to recreate the tables with the new schema:

Open a terminal in `e:\My_Github_Projects\Jaabo\busgo` and run:
```bash
docker-compose down -v
docker-compose up -d
```
*Note: The `-v` flag deletes the database volume, meaning all existing data will be erased. The containers will then start fresh, creating the new tables automatically based on your modified Python files.*



Ran command: `.\start_jaabo.bat`
Ran command: `docker ps`
Viewed start_jaabo.bat:1-64
Viewed Database%20Models%20Guide.md:1-196
Viewed docker-compose.yml:1-306
Ran command: `docker exec infrastructure-postgres-1 psql -U user -d auth_db -c "\dt"`
Ran command: `docker exec infrastructure-postgres-1 psql -U user -d auth_db -c "SELECT * FROM users LIMIT 5;"`

Based on the current setup of the Jaabo (BusGo) project, your database is running successfully via Docker.

Here is the current status and how you can view your data.

### 1. Current Database Status
Your database is a **PostgreSQL 15** instance running inside a Docker container named `infrastructure-postgres-1`. 
- **Status:** **Running & Healthy**
- **Host:** `localhost`
- **Port:** `5432`
- **Username:** `user`
- **Password:** `password`
- **Databases:** The container runs multiple isolated databases for your microservices (e.g., `auth_db`, `booking_db`, `operator_db`, `payment_db`, `ticket_db`, etc.).

*(Note: Currently, the tables have been created, but checking `auth_db` shows that the tables are empty right now, likely because the containers were just started).*

---

### 2. How to View Data in the Database

You have a few different options for viewing and managing your data, depending on what you're most comfortable with:

#### Option A: Using a GUI Tool (Recommended)
This is the easiest way to visualize your tables and data. You can download and install any of these popular free tools:
* **DBeaver** (Highly recommended for microservice architectures)
* **pgAdmin 4**
* **VS Code Extensions** (e.g., "SQLTools" or "Database Client" right inside your editor)

**How to connect:**
1. Open your chosen tool and create a new **PostgreSQL** connection.
2. Enter the following details:
   * **Host:** `localhost`
   * **Port:** `5432`
   * **Database:** Type the specific database you want to look at (e.g., `auth_db` or `operator_db`).
   * **Username:** `user`
   * **Password:** `password`
3. Connect and you'll be able to see your tables and run SQL queries visually.

#### Option B: Using the Terminal (Docker Command Line)
If you prefer not to install any additional software, you can run queries directly from your terminal using Docker's built-in `psql` command.

1. **To list all tables in a specific database** (e.g., `auth_db`):
   ```bash
   docker exec -it infrastructure-postgres-1 psql -U user -d auth_db -c "\dt"
   ```

2. **To view data in a specific table** (e.g., the `users` table):
   ```bash
   docker exec -it infrastructure-postgres-1 psql -U user -d auth_db -c "SELECT * FROM users;"
   ```

3. **To open an interactive SQL session:**
   ```bash
   docker exec -it infrastructure-postgres-1 psql -U user -d auth_db
   ```
   *(Inside the session, you can run normal SQL commands. Type `\q` to exit).*

**Remember:** Since this is a microservices architecture, there isn't just one database. If you want to see bus and trip data, you'll need to connect to `operator_db`. If you want to see user data, connect to `auth_db`. You can refer to your `Database Models Guide.md` file for a full list of which tables exist in which database.