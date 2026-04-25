import asyncio
import sys
import os

sys.path.append(os.path.abspath('busgo/services/auth-service'))
sys.path.append(os.path.abspath('busgo'))

from database import async_session
from models.user import User
from sqlalchemy import select

async def main():
    async with async_session() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()
        for u in users:
            print(f"User: {u.phone}, Role: {u.role}")

asyncio.run(main())
