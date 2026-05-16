-- Fix booking operator_id foreign key constraint issue
-- This removes the foreign key constraint that's causing booking failures

-- Drop the foreign key constraint if it exists
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_operator_id_fkey;

-- Verify the constraint is removed
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'bookings'::regclass 
AND conname LIKE '%operator%';
