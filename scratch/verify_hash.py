import bcrypt

stored_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU7qXqXqXqXq'
print("Hash length:", len(stored_hash))
print("Hash:", stored_hash)

try:
    match = bcrypt.checkpw(b'admin123', stored_hash.encode('utf-8'))
    print("Matches 'admin123':", match)
except Exception as e:
    print("Error:", e)
