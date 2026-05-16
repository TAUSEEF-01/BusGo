-- =====================================================
-- SUPABASE SETUP VERIFICATION SCRIPT
-- =====================================================
-- Run this after executing supabase_complete_schema.sql
-- to verify everything was created correctly

-- =====================================================
-- 1. CHECK ALL TABLES
-- =====================================================
SELECT 
    '=== TABLES ===' as section,
    table_name,
    (SELECT COUNT(*) 
     FROM information_schema.columns 
     WHERE table_name = t.table_name 
     AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =====================================================
-- 2. CHECK ALL ENUMS
-- =====================================================
SELECT 
    '=== ENUMS ===' as section,
    t.typname as enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- =====================================================
-- 3. CHECK ROW LEVEL SECURITY STATUS
-- =====================================================
SELECT 
    '=== RLS STATUS ===' as section,
    tablename,
    CASE WHEN rowsecurity THEN '✓ Enabled' ELSE '✗ Disabled' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- =====================================================
-- 4. CHECK FOREIGN KEY RELATIONSHIPS
-- =====================================================
SELECT 
    '=== FOREIGN KEYS ===' as section,
    tc.table_name as from_table,
    kcu.column_name as from_column,
    ccu.table_name as to_table,
    ccu.column_name as to_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- 5. CHECK INDEXES
-- =====================================================
SELECT 
    '=== INDEXES ===' as section,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- =====================================================
-- 6. CHECK EXTENSIONS
-- =====================================================
SELECT 
    '=== EXTENSIONS ===' as section,
    extname as extension_name,
    extversion as version
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'pgcrypto')
ORDER BY extname;

-- =====================================================
-- 7. CHECK DEFAULT ADMIN USER
-- =====================================================
SELECT 
    '=== ADMIN USER ===' as section,
    id,
    phone,
    email,
    full_name,
    role,
    is_verified,
    is_active,
    created_at
FROM users
WHERE role = 'ADMIN'
LIMIT 1;

-- =====================================================
-- 8. CHECK TABLE COUNTS (Should be 0 for fresh install)
-- =====================================================
SELECT '=== TABLE ROW COUNTS ===' as section;

SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'operators', COUNT(*) FROM operators
UNION ALL
SELECT 'buses', COUNT(*) FROM buses
UNION ALL
SELECT 'routes', COUNT(*) FROM routes
UNION ALL
SELECT 'trips', COUNT(*) FROM trips
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'tickets', COUNT(*) FROM tickets
UNION ALL
SELECT 'seat_inventory', COUNT(*) FROM seat_inventory
UNION ALL
SELECT 'cancellation_requests', COUNT(*) FROM cancellation_requests
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'deals', COUNT(*) FROM deals
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
ORDER BY table_name;

-- =====================================================
-- 9. CHECK RLS POLICIES
-- =====================================================
SELECT 
    '=== RLS POLICIES ===' as section,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- 10. SUMMARY
-- =====================================================
SELECT '=== SETUP SUMMARY ===' as section;

SELECT 
    'Total Tables' as metric,
    COUNT(*)::text as value
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'

UNION ALL

SELECT 
    'Total Enums',
    COUNT(DISTINCT t.typname)::text
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'

UNION ALL

SELECT 
    'Tables with RLS',
    COUNT(*)::text
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true

UNION ALL

SELECT 
    'Total Foreign Keys',
    COUNT(*)::text
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'

UNION ALL

SELECT 
    'Total Indexes',
    COUNT(*)::text
FROM pg_indexes
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'Total RLS Policies',
    COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public';

-- =====================================================
-- EXPECTED RESULTS
-- =====================================================
/*
Expected Summary:
- Total Tables: 17
- Total Enums: 11
- Tables with RLS: 11
- Total Foreign Keys: 20+
- Total Indexes: 40+
- Total RLS Policies: 15+

If any numbers are significantly different, review the setup.
*/
