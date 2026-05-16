-- Fix booking_status enum to include missing values
-- Run this in Supabase SQL Editor

-- Add SEAT_LOCKED to the booking_status enum (used when seats are temporarily locked during booking)
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'SEAT_LOCKED';

-- Add REFUNDED to the booking_status enum (used when a cancelled booking is refunded)
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'REFUNDED';

-- Verify the enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'booking_status'::regtype
ORDER BY enumsortorder;

-- Expected output should include all these values:
-- INITIATED
-- PAYMENT_PENDING
-- CONFIRMED
-- CANCELLED
-- EXPIRED
-- COMPLETED
-- SEAT_LOCKED
-- REFUNDED
