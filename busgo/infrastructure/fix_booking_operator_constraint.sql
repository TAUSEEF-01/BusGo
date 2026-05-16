-- Fix booking operator foreign key constraint issue
-- Run this in Supabase SQL Editor

-- SOLUTION: Create a default/system operator for the hardcoded UUID
-- This allows bookings to work even when operator_id is not properly passed from frontend

-- Create the system operator with the hardcoded UUID from the frontend
INSERT INTO operators (id, name, contact_phone, contact_email, address, license_no)
VALUES (
    '12345678-1234-5678-1234-567812345678'::uuid,
    'System Operator',
    '+8801700000000',
    'system@busgo.com',
    'Dhaka, Bangladesh',
    'SYS-2024-001'
)
ON CONFLICT (id) DO NOTHING;

-- Verify the operator was created
SELECT id, name, contact_phone, contact_email FROM operators 
WHERE id = '12345678-1234-5678-1234-567812345678'::uuid;

-- Check if there are any trips using this operator_id
SELECT COUNT(*) as trip_count FROM trips 
WHERE operator_id = '12345678-1234-5678-1234-567812345678'::uuid;

-- IMPORTANT: After running this, you should:
-- 1. Ensure all trips have valid operator_ids
-- 2. Update the frontend to always pass the correct operator_id from trip data
-- 3. Remove the fallback hardcoded UUID from PassengerDetails.tsx and SelectSeats.tsx
