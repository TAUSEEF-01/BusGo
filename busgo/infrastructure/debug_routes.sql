-- Debug script to check routes and operators
-- Run this in Supabase SQL Editor

-- 1. Check all routes with their operator info
SELECT 
    r.id as route_id,
    r.operator_id,
    r.origin_city,
    r.destination_city,
    r.distance_km,
    o.name as operator_name,
    o.contact_phone as operator_phone
FROM routes r
LEFT JOIN operators o ON r.operator_id = o.id
ORDER BY r.created_at DESC;

-- 2. Check all operators
SELECT 
    id as operator_id,
    name,
    contact_phone,
    contact_email,
    created_at
FROM operators
ORDER BY created_at DESC;

-- 3. Check all users with OPERATOR role
SELECT 
    id as user_id,
    phone,
    email,
    full_name,
    role,
    is_active
FROM users
WHERE role = 'OPERATOR'
ORDER BY created_at DESC;

-- 4. Find orphaned routes (routes without matching operators)
SELECT 
    r.id as route_id,
    r.operator_id,
    r.origin_city,
    r.destination_city,
    'No matching operator found' as issue
FROM routes r
LEFT JOIN operators o ON r.operator_id = o.id
WHERE o.id IS NULL;

-- 5. Count routes per operator
SELECT 
    o.id as operator_id,
    o.name as operator_name,
    COUNT(r.id) as route_count
FROM operators o
LEFT JOIN routes r ON o.id = r.operator_id
GROUP BY o.id, o.name
ORDER BY route_count DESC;
