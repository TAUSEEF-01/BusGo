-- Add buses for dummy operators
INSERT INTO buses (id, operator_id, registration_no, bus_type, total_seats, seat_layout, amenities, is_active) VALUES 
('e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'SH-001', 'NON_AC', 40, '{}', '["usb"]', true),
('f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'EN-001', 'AC', 36, '{}', '["ac", "wifi"]', true),
('a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d', 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'SO-001', 'NON_AC', 45, '{}', '[]', true),
('b8c9d0e1-f2a3-4b5c-5d6e-7f8a9b0c1d2e', 'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', 'DT-001', 'SLEEPER', 30, '{}', '["ac", "wifi", "usb"]', true)
ON CONFLICT (registration_no) DO NOTHING;

-- Add routes for dummy operators
INSERT INTO routes (id, operator_id, origin_city, destination_city, distance_km, estimated_duration_hours, boarding_points, dropping_points) VALUES
(gen_random_uuid(), 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Dhaka', 'Chittagong', 250, 5.5, '["Gabtoli", "Sayedabad"]', '["AK Khan", "Dampara"]'),
(gen_random_uuid(), 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Dhaka', 'Sylhet', 240, 6.0, '["Gabtoli", "Fakirapool"]', '["Kadamtali"]'),
(gen_random_uuid(), 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'Dhaka', 'Chittagong', 250, 5.5, '["Gabtoli"]', '["AK Khan"]'),
(gen_random_uuid(), 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'Dhaka', 'Sylhet', 240, 6.0, '["Gabtoli"]', '["Kadamtali"]'),
(gen_random_uuid(), 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'Dhaka', 'Chittagong', 250, 5.5, '["Gabtoli"]', '["AK Khan"]'),
(gen_random_uuid(), 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'Dhaka', 'Sylhet', 240, 6.0, '["Gabtoli"]', '["Kadamtali"]'),
(gen_random_uuid(), 'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', 'Dhaka', 'Chittagong', 250, 5.5, '["Gabtoli"]', '["AK Khan"]'),
(gen_random_uuid(), 'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', 'Dhaka', 'Sylhet', 240, 6.0, '["Gabtoli"]', '["Kadamtali"]')
ON CONFLICT DO NOTHING;
