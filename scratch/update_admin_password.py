import asyncio
import sys
import os
import bcrypt

sys.path.append(os.path.abspath('busgo'))

from shared.database_config import get_database_url
from sqlalchemy import create_engine, text

def update_admin():
    url = get_database_url(async_driver=False)
    print("Generating correct bcrypt hash for 'admin123'...")
    new_hash = bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode('utf-8')
    print(f"Generated hash: {new_hash}")
    
    print("Connecting to database to update admin password...")
    try:
        engine = create_engine(url, connect_args={"sslmode": "require"})
        with engine.connect() as conn:
            # First check if user exists
            check_result = conn.execute(text("SELECT id, phone, email, password_hash FROM users WHERE email = 'admin@busgo.com'"))
            user = check_result.fetchone()
            if not user:
                print("ERROR: Admin user with email 'admin@busgo.com' not found in database!")
                return
            
            print(f"Found admin user: ID={user[0]}, Phone={user[1]}, Current Hash={user[3]}")
            
            # Update password hash
            conn.execute(
                text("UPDATE users SET password_hash = :new_hash WHERE email = 'admin@busgo.com'"),
                {"new_hash": new_hash}
            )
            # SQLAlchemy commit (if not autocommit)
            conn.commit()
            print("Successfully updated password hash in database!")
            
            # Verify update
            verify_result = conn.execute(text("SELECT password_hash FROM users WHERE email = 'admin@busgo.com'"))
            updated_hash = verify_result.scalar()
            print(f"Verified updated hash in DB: {updated_hash}")
            
            # Verify bcrypt matches 'admin123'
            matches = bcrypt.checkpw(b'admin123', updated_hash.encode('utf-8'))
            print(f"Bcrypt verification of retrieved hash against 'admin123': {matches}")
            
        engine.dispose()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    update_admin()
