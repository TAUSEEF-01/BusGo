import sys
import os
import asyncio

sys.path.append(os.path.abspath('busgo/services/auth-service'))
sys.path.append(os.path.abspath('busgo'))

from database import engine, Base, async_session
from models.user import User
from shared.enums import UserRole

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        
    async with async_session() as db:
        user = User(
            phone="123",
            full_name="Test",
            password_hash="pass",
            is_verified=True
        )
        if UserRole.OPERATOR:
            user.role = UserRole.OPERATOR
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print("User role after commit:", user.role)

asyncio.run(main())
