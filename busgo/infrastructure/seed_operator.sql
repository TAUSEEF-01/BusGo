INSERT INTO operators (id, name, contact_phone, contact_email, address, license_no, commission_rate, is_active, created_at)
VALUES 
    ('84cd0cc6-ac4a-43f9-ade7-d982f7494077', 'Greenline Paribahan', '01711111111', 'info@greenline.com', 'Dhaka', 'GL-1234', 0.10, true, NOW()),
    ('f2c8d2d6-1b4e-4f2e-8c3b-2a9c1e4d9f6a', 'Hanif Enterprise', '01722222222', 'info@hanif.com', 'Dhaka', 'HN-5678', 0.12, true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO routes (id, operator_id, origin_city, destination_city, distance_km, estimated_duration_hours, boarding_points, dropping_points)
VALUES 
    (gen_random_uuid(), '84cd0cc6-ac4a-43f9-ade7-d982f7494077', 'Dhaka', 'Chittagong', 250, 5.5, '["Gabtoli", "Sayedabad"]', '["AK Khan", "Dampara"]'),
    (gen_random_uuid(), '84cd0cc6-ac4a-43f9-ade7-d982f7494077', 'Dhaka', 'Sylhet', 240, 6.0, '["Gabtoli", "Fakirapool"]', '["Kadamtali", "Humayun Rashid Chottor"]'),
    (gen_random_uuid(), 'f2c8d2d6-1b4e-4f2e-8c3b-2a9c1e4d9f6a', 'Dhaka', 'Coxs Bazar', 400, 10.0, '["Gabtoli", "Arambagh"]', '["Kolatoli"]'),
    (gen_random_uuid(), 'f2c8d2d6-1b4e-4f2e-8c3b-2a9c1e4d9f6a', 'Dhaka', 'Khulna', 280, 7.0, '["Gabtoli", "Kalyanpur"]', '["Sonadanga"]')
ON CONFLICT DO NOTHING;
