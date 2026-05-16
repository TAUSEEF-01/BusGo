-- QUICK FIX: Link all routes to your operator account
-- 
-- HOW TO USE:
-- 1. Login to your operator account in the frontend
-- 2. Open browser console (F12) and note your user ID
-- 3. Replace 'PASTE_YOUR_USER_ID_HERE' below with your actual UUID
-- 4. Run this entire script in Supabase SQL Editor
-- 5. Refresh the operator dashboard

-- ============================================
-- CONFIGURATION - EDIT THIS SECTION
-- ============================================
DO $$
DECLARE
    my_user_id UUID := 'PASTE_YOUR_USER_ID_HERE'::uuid;  -- ← CHANGE THIS!
    my_company_name TEXT := 'My Bus Company';             -- ← CHANGE THIS!
    my_phone TEXT := '+8801234567890';                    -- ← CHANGE THIS!
    my_email TEXT := 'operator@example.com';              -- ← CHANGE THIS!
    my_address TEXT := 'Dhaka, Bangladesh';               -- ← CHANGE THIS!
    my_license TEXT := 'OP-2024-001';                     -- ← CHANGE THIS!
BEGIN
    -- Step 1: Create or update operator record
    INSERT INTO operators (id, name, contact_phone, contact_email, address, license_no)
    VALUES (my_user_id, my_company_name, my_phone, my_email, my_address, my_license)
    ON CONFLICT (id) 
    DO UPDATE SET
        name = EXCLUDED.name,
        contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email,
        address = EXCLUDED.address,
        license_no = EXCLUDED.license_no;
    
    RAISE NOTICE 'Operator record created/updated for ID: %', my_user_id;
    
    -- Step 2: Link all orphaned routes to this operator
    UPDATE routes
    SET operator_id = my_user_id
    WHERE operator_id NOT IN (SELECT id FROM operators)
       OR operator_id IS NULL;
    
    RAISE NOTICE 'Orphaned routes linked to operator';
    
    -- Step 3: Show summary
    RAISE NOTICE '=== SUMMARY ===';
    RAISE NOTICE 'Total routes for your operator: %', (SELECT COUNT(*) FROM routes WHERE operator_id = my_user_id);
    RAISE NOTICE 'Total buses for your operator: %', (SELECT COUNT(*) FROM buses WHERE operator_id = my_user_id);
    RAISE NOTICE 'Total trips for your operator: %', (SELECT COUNT(*) FROM trips WHERE operator_id = my_user_id);
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Show your routes
SELECT 
    'YOUR ROUTES' as section,
    r.id,
    r.origin_city,
    r.destination_city,
    r.distance_km,
    r.created_at
FROM routes r
WHERE r.operator_id = 'PASTE_YOUR_USER_ID_HERE'::uuid  -- ← CHANGE THIS!
ORDER BY r.created_at DESC;

-- Show your buses
SELECT 
    'YOUR BUSES' as section,
    b.id,
    b.registration_no,
    b.bus_type,
    b.total_seats,
    b.is_active
FROM buses b
WHERE b.operator_id = 'PASTE_YOUR_USER_ID_HERE'::uuid  -- ← CHANGE THIS!
ORDER BY b.created_at DESC;

-- Show your trips
SELECT 
    'YOUR TRIPS' as section,
    t.id,
    r.origin_city || ' → ' || r.destination_city as route,
    b.registration_no as bus,
    t.departure_datetime,
    t.fare_amount,
    t.status
FROM trips t
JOIN routes r ON t.route_id = r.id
JOIN buses b ON t.bus_id = b.id
WHERE t.operator_id = 'PASTE_YOUR_USER_ID_HERE'::uuid  -- ← CHANGE THIS!
ORDER BY t.departure_datetime DESC;
