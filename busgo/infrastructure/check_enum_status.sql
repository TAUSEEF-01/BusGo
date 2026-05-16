-- Check if the booking_status enum has all required values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'booking_status'::regtype
ORDER BY enumsortorder;

-- This should return:
-- INITIATED
-- PAYMENT_PENDING
-- CONFIRMED
-- CANCELLED
-- EXPIRED
-- COMPLETED
-- SEAT_LOCKED (if fix was applied)
-- REFUNDED (if fix was applied)
