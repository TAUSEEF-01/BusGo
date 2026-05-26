import asyncio
import sys
import os

sys.path.append(os.path.abspath('busgo'))

from shared.database_config import get_database_url
from sqlalchemy import create_engine, text

def fetch_users():
    url = get_database_url(async_driver=False)
    print(f"Connecting to database...")
    try:
        engine = create_engine(url, connect_args={"sslmode": "require"})
        with engine.connect() as conn:
            result = conn.execute(text("SELECT id, phone, email, full_name, password_hash, role, is_verified, is_active FROM users"))
            users = result.fetchall()
            print(f"\nFound {len(users)} users in the database:")
            print("-" * 100)
            for user in users:
                print(f"ID: {user[0]}")
                print(f"Phone: {user[1]}")
                print(f"Email: {user[2]}")
                print(f"Full Name: {user[3]}")
                print(f"Password Hash: {user[4]}")
                print(f"Role: {user[5]}")
                print(f"Is Verified: {user[6]}")
                print(f"Is Active: {user[7]}")
                print("-" * 100)
        engine.dispose()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    fetch_users()
