import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from shared.database_config import get_database_url, get_db_connect_args

DATABASE_URL = get_database_url(async_driver=True)
engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    connect_args=get_db_connect_args(DATABASE_URL, async_driver=True),
    # Bounded pool so horizontally-scaled replicas don't exhaust the shared
    # Supabase transaction pooler. Tune via DB_POOL_SIZE / DB_MAX_OVERFLOW.
    pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "2")),
    pool_pre_ping=True,
)
async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_db():
    async with async_session() as session:
        yield session




