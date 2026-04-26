-- Create trips for Shyamoli Paribahan (Dhaka -> Chittagong)
INSERT INTO trips (id, operator_id, bus_id, route_id, departure_datetime, arrival_datetime, fare_amount, available_seats, status)
SELECT gen_random_uuid(), 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', id, '2026-05-01 10:00:00', '2026-05-01 16:00:00', 550, 35, 'SCHEDULED'
FROM routes WHERE operator_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d' AND origin_city = 'Dhaka' AND destination_city = 'Chittagong' LIMIT 1;

-- Create trips for Shyamoli Paribahan (Dhaka -> Sylhet)
INSERT INTO trips (id, operator_id, bus_id, route_id, departure_datetime, arrival_datetime, fare_amount, available_seats, status)
SELECT gen_random_uuid(), 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', id, '2026-05-01 12:00:00', '2026-05-01 18:00:00', 550, 38, 'SCHEDULED'
FROM routes WHERE operator_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d' AND origin_city = 'Dhaka' AND destination_city = 'Sylhet' LIMIT 1;

-- Create trips for Ena Transport (Dhaka -> Chittagong)
INSERT INTO trips (id, operator_id, bus_id, route_id, departure_datetime, arrival_datetime, fare_amount, available_seats, status)
SELECT gen_random_uuid(), 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', id, '2026-05-01 14:00:00', '2026-05-01 19:30:00', 800, 30, 'SCHEDULED'
FROM routes WHERE operator_id = 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e' AND origin_city = 'Dhaka' AND destination_city = 'Chittagong' LIMIT 1;

-- Create trips for Ena Transport (Dhaka -> Sylhet)
INSERT INTO trips (id, operator_id, bus_id, route_id, departure_datetime, arrival_datetime, fare_amount, available_seats, status)
SELECT gen_random_uuid(), 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', id, '2026-05-01 16:00:00', '2026-05-01 22:00:00', 800, 32, 'SCHEDULED'
FROM routes WHERE operator_id = 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e' AND origin_city = 'Dhaka' AND destination_city = 'Sylhet' LIMIT 1;

-- Create trips for Sohag Paribahan (Dhaka -> Chittagong)
INSERT INTO trips (id, operator_id, bus_id, route_id, departure_datetime, arrival_datetime, fare_amount, available_seats, status)
SELECT gen_random_uuid(), 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d', id, '2026-05-01 07:00:00', '2026-05-01 13:00:00', 500, 40, 'SCHEDULED'
FROM routes WHERE operator_id = 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f' AND origin_city = 'Dhaka' AND destination_city = 'Chittagong' LIMIT 1;

-- Create trips for Sohag Paribahan (Dhaka -> Sylhet)
INSERT INTO trips (id, operator_id, bus_id, route_id, departure_datetime, arrival_datetime, fare_amount, available_seats, status)
SELECT gen_random_uuid(), 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d', id, '2026-05-01 09:00:00', '2026-05-01 15:00:00', 500, 42, 'SCHEDULED'
FROM routes WHERE operator_id = 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f' AND origin_city = 'Dhaka' AND destination_city = 'Sylhet' LIMIT 1;

-- Create trips for Desh Travels (Dhaka -> Chittagong)
INSERT INTO trips (id, operator_id, bus_id, route_id, departure_datetime, arrival_datetime, fare_amount, available_seats, status)
SELECT gen_random_uuid(), 'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', 'b8c9d0e1-f2a3-4b5c-5d6e-7f8a9b0c1d2e', id, '2026-05-01 22:00:00', '2026-05-02 04:00:00', 1200, 25, 'SCHEDULED'
FROM routes WHERE operator_id = 'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a' AND origin_city = 'Dhaka' AND destination_city = 'Chittagong' LIMIT 1;

-- Create trips for Desh Travels (Dhaka -> Sylhet)
INSERT INTO trips (id, operator_id, bus_id, route_id, departure_datetime, arrival_datetime, fare_amount, available_seats, status)
SELECT gen_random_uuid(), 'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', 'b8c9d0e1-f2a3-4b5c-5d6e-7f8a9b0c1d2e', id, '2026-05-01 23:00:00', '2026-05-02 05:00:00', 1200, 28, 'SCHEDULED'
FROM routes WHERE operator_id = 'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a' AND origin_city = 'Dhaka' AND destination_city = 'Sylhet' LIMIT 1;
