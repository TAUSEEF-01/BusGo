-- =====================================================
-- BUSGO COMPLETE DATABASE SCHEMA FOR SUPABASE
-- =====================================================
-- This script creates all tables, enums, extensions, and RLS policies
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. ENABLE REQUIRED EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 2. CREATE ENUMS
-- =====================================================

-- User Role Enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('CUSTOMER', 'OPERATOR', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Booking Status Enum
DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM (
        'INITIATED',
        'PAYMENT_PENDING',
        'CONFIRMED',
        'CANCELLED',
        'EXPIRED',
        'COMPLETED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment Method Enum
DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM (
        'CREDIT_CARD',
        'DEBIT_CARD',
        'UPI',
        'NET_BANKING',
        'WALLET'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment Status Enum
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'PENDING',
        'COMPLETED',
        'FAILED',
        'REFUNDED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Refund Status Enum
DO $$ BEGIN
    CREATE TYPE refund_status AS ENUM (
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ticket Status Enum
DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM (
        'ACTIVE',
        'USED',
        'CANCELLED',
        'EXPIRED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Seat Type Enum
DO $$ BEGIN
    CREATE TYPE seat_type AS ENUM (
        'WINDOW',
        'AISLE',
        'SLEEPER_UPPER',
        'SLEEPER_LOWER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Seat Status Enum
DO $$ BEGIN
    CREATE TYPE seat_status AS ENUM (
        'AVAILABLE',
        'LOCKED',
        'BOOKED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bus Type Enum
DO $$ BEGIN
    CREATE TYPE bus_type AS ENUM (
        'AC',
        'NON_AC',
        'SLEEPER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Trip Status Enum
DO $$ BEGIN
    CREATE TYPE trip_status AS ENUM (
        'SCHEDULED',
        'CANCELLED',
        'COMPLETED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Cancellation Status Enum
DO $$ BEGIN
    CREATE TYPE cancellation_status AS ENUM (
        'PENDING',
        'APPROVED',
        'REJECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 3. AUTH SERVICE TABLES
-- =====================================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR UNIQUE,
    email VARCHAR UNIQUE,
    full_name VARCHAR NOT NULL,
    password_hash VARCHAR,
    auth_provider VARCHAR NOT NULL DEFAULT 'password',
    provider_subject VARCHAR UNIQUE,
    role user_role DEFAULT 'CUSTOMER',
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_provider_subject ON users(provider_subject);

-- OTP Records Table
CREATE TABLE IF NOT EXISTS otp_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_records(phone);

-- Refresh Tokens Table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- =====================================================
-- 4. OPERATOR SERVICE TABLES
-- =====================================================

-- Operators Table
CREATE TABLE IF NOT EXISTS operators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    contact_phone VARCHAR NOT NULL,
    contact_email VARCHAR NOT NULL,
    address VARCHAR NOT NULL,
    license_no VARCHAR NOT NULL,
    commission_rate FLOAT DEFAULT 10.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buses Table
CREATE TABLE IF NOT EXISTS buses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    registration_no VARCHAR UNIQUE NOT NULL,
    bus_type bus_type NOT NULL,
    total_seats INTEGER NOT NULL,
    seat_layout JSONB NOT NULL,
    amenities JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buses_operator ON buses(operator_id);
CREATE INDEX IF NOT EXISTS idx_buses_registration ON buses(registration_no);

-- Routes Table
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    origin_city VARCHAR NOT NULL,
    destination_city VARCHAR NOT NULL,
    distance_km FLOAT NOT NULL,
    estimated_duration_hours FLOAT NOT NULL,
    boarding_points JSONB NOT NULL,
    dropping_points JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routes_operator ON routes(operator_id);
CREATE INDEX IF NOT EXISTS idx_routes_origin ON routes(origin_city);
CREATE INDEX IF NOT EXISTS idx_routes_destination ON routes(destination_city);

-- Trips Table
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    departure_datetime TIMESTAMPTZ NOT NULL,
    arrival_datetime TIMESTAMPTZ NOT NULL,
    fare_amount NUMERIC(10, 2) NOT NULL,
    available_seats INTEGER NOT NULL,
    status trip_status DEFAULT 'SCHEDULED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_operator ON trips(operator_id);
CREATE INDEX IF NOT EXISTS idx_trips_bus ON trips(bus_id);
CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(route_id);
CREATE INDEX IF NOT EXISTS idx_trips_departure ON trips(departure_datetime);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

-- =====================================================
-- 5. INVENTORY SERVICE TABLES
-- =====================================================

-- Seat Inventory Table
CREATE TABLE IF NOT EXISTS seat_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    seat_number VARCHAR NOT NULL,
    seat_type seat_type NOT NULL,
    status seat_status DEFAULT 'AVAILABLE',
    locked_by_booking_id UUID,
    lock_expires_at TIMESTAMPTZ,
    booked_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trip_id, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_seat_inventory_trip ON seat_inventory(trip_id);
CREATE INDEX IF NOT EXISTS idx_seat_inventory_status ON seat_inventory(status);
CREATE INDEX IF NOT EXISTS idx_seat_inventory_booking ON seat_inventory(locked_by_booking_id);

-- =====================================================
-- 6. BOOKING SERVICE TABLES
-- =====================================================

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    seat_numbers JSONB NOT NULL,
    passenger_details JSONB NOT NULL,
    boarding_point VARCHAR NOT NULL,
    dropping_point VARCHAR NOT NULL,
    journey_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    total_fare NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0.0,
    promo_code VARCHAR,
    status booking_status DEFAULT 'INITIATED',
    idempotency_key VARCHAR UNIQUE NOT NULL,
    payment_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_operator ON bookings(operator_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_idempotency ON bookings(idempotency_key);

-- Booking Status History Table
CREATE TABLE IF NOT EXISTS booking_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    from_status booking_status,
    to_status booking_status NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    reason VARCHAR
);

CREATE INDEX IF NOT EXISTS idx_booking_history_booking ON booking_status_history(booking_id);

-- =====================================================
-- 7. PAYMENT SERVICE TABLES
-- =====================================================

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    method payment_method NOT NULL,
    gateway_transaction_id VARCHAR UNIQUE,
    status payment_status DEFAULT 'PENDING',
    gateway_response JSONB,
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_trip ON payments(trip_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Refunds Table
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    reason VARCHAR NOT NULL,
    status refund_status DEFAULT 'PENDING',
    gateway_refund_id VARCHAR,
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    estimated_days INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_booking ON refunds(booking_id);

-- =====================================================
-- 8. TICKET SERVICE TABLES
-- =====================================================

-- Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    seat_numbers JSONB NOT NULL,
    passenger_details JSONB NOT NULL,
    qr_code_data VARCHAR UNIQUE NOT NULL,
    qr_code_url VARCHAR,
    pdf_url VARCHAR,
    status ticket_status DEFAULT 'ACTIVE',
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_booking ON tickets(booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_trip ON tickets(trip_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_data ON tickets(qr_code_data);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

-- =====================================================
-- 9. CANCELLATION SERVICE TABLES
-- =====================================================

-- Cancellation Requests Table
CREATE TABLE IF NOT EXISTS cancellation_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    status cancellation_status DEFAULT 'PENDING',
    rejection_reason VARCHAR,
    refund_amount NUMERIC(10, 2),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cancellation_booking ON cancellation_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_user ON cancellation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_status ON cancellation_requests(status);

-- =====================================================
-- 10. NOTIFICATION SERVICE TABLES (Optional)
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- =====================================================
-- 11. DEALS SERVICE TABLES (Optional)
-- =====================================================

CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR NOT NULL,
    description TEXT NOT NULL,
    discount_percentage NUMERIC(5, 2) NOT NULL,
    promo_code VARCHAR UNIQUE NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_promo_code ON deals(promo_code);
CREATE INDEX IF NOT EXISTS idx_deals_active ON deals(is_active);

-- =====================================================
-- 12. AUDIT SERVICE TABLES (Optional)
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR NOT NULL,
    entity_type VARCHAR NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- =====================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Users can view their own bookings
CREATE POLICY "Users can view own bookings" ON bookings
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own bookings" ON bookings
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Users can view their own payments
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Users can view their own tickets
CREATE POLICY "Users can view own tickets" ON tickets
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Users can view their own cancellation requests
CREATE POLICY "Users can view own cancellations" ON cancellation_requests
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own cancellations" ON cancellation_requests
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Public read access for operators, buses, routes, trips (search functionality)
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active operators" ON operators
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public can view active buses" ON buses
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public can view routes" ON routes
    FOR SELECT USING (true);

CREATE POLICY "Public can view scheduled trips" ON trips
    FOR SELECT USING (status = 'SCHEDULED');

CREATE POLICY "Public can view available seats" ON seat_inventory
    FOR SELECT USING (true);

-- =====================================================
-- 14. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seat_inventory_updated_at BEFORE UPDATE ON seat_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 15. INITIAL DATA / SEED (Optional)
-- =====================================================

-- Users are provisioned through verified Google sign-in. Promote a verified
-- account to ADMIN explicitly after its first login; never seed a shared password.

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify all tables were created:
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
ORDER BY table_name;
