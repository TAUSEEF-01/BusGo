INSERT INTO payments (id, booking_id, user_id, trip_id, amount, method, gateway_transaction_id, status, initiated_at, completed_at)
VALUES 
    (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1720.00, 'BKASH', 'TXN-BK-1001', 'COMPLETED', NOW() - INTERVAL '1 DAY', NOW() - INTERVAL '1 DAY'),
    (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 750.00, 'CARD', 'TXN-CD-1002', 'COMPLETED', NOW() - INTERVAL '2 DAYS', NOW() - INTERVAL '2 DAYS'),
    (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 2440.00, 'NAGAD', 'TXN-NG-1003', 'FAILED', NOW() - INTERVAL '3 DAYS', NULL),
    (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 780.00, 'INTERNET_BANKING', 'TXN-IB-1004', 'REFUNDED', NOW() - INTERVAL '4 DAYS', NOW() - INTERVAL '4 DAYS'),
    (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1200.00, 'BKASH', 'TXN-BK-1005', 'COMPLETED', NOW(), NOW()),
    (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 3000.00, 'CARD', 'TXN-CD-1006', 'COMPLETED', NOW(), NOW()),
    (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 500.00, 'NAGAD', 'TXN-NG-1007', 'PENDING', NOW(), NULL)
ON CONFLICT DO NOTHING;
