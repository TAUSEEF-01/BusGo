-- Fix script to link routes to the correct operator
-- 
-- INSTRUCTIONS:
-- 1. First, run debug_routes.sql to identify your user_id and the route's operator_id
-- 2. Then update the variables below with your actual IDs
-- 3. Run this script to fix the association

-- ============================================
-- OPTION 1: Update existing route to match your user ID
-- ============================================
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID from the login
-- Replace 'YOUR_ROUTE_ID_HERE' with the route ID you want to fix

-- First, ensure an operator record exists for your user
INSERT INTO operators (id, name, contact_phone, contact_email, address, license_no)
VALUES (
    'YOUR_USER_ID_HERE'::uuid,  -- Use your user ID
    'My Operator Company',       -- Change this to your company name
    '+8801234567890',            -- Change this to your phone
    'operator@example.com',      -- Change this to your email
    'Dhaka, Bangladesh',         -- Change this to your address
    'OP-2024-001'                -- Change this to your license number
)
ON CONFLICT (id) DO NOTHING;  -- Won't insert if operator already exists

-- Then update the route to use your operator ID
UPDATE routes
SET operator_id = 'YOUR_USER_ID_HERE'::uuid
WHERE id = 'YOUR_ROUTE_ID_HERE'::uuid;

-- ============================================
-- OPTION 2: Update ALL routes to match your user ID
-- ============================================
-- Use this if you want to claim all existing routes
-- (Uncomment the lines below to use)

-- INSERT INTO operators (id, name, contact_phone, contact_email, address, license_no)
-- VALUES (
--     'YOUR_USER_ID_HERE'::uuid,
--     'My Operator Company',
--     '+8801234567890',
--     'operator@example.com',
--     'Dhaka, Bangladesh',
--     'OP-2024-001'
-- )
-- ON CONFLICT (id) DO NOTHING;

-- UPDATE routes
-- SET operator_id = 'YOUR_USER_ID_HERE'::uuid;

-- ============================================
-- VERIFY THE FIX
-- ============================================
-- Run this to verify the routes are now linked to your operator
SELECT 
    r.id as route_id,
    r.operator_id,
    r.origin_city,
    r.destination_city,
    o.name as operator_name
FROM routes r
LEFT JOIN operators o ON r.operator_id = o.id
WHERE r.operator_id = 'YOUR_USER_ID_HERE'::uuid;
