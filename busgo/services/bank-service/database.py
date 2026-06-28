from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from shared.database_config import get_database_url, get_db_connect_args

DATABASE_URL = get_database_url(async_driver=True)
engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    pool_pre_ping=True,
    connect_args=get_db_connect_args(DATABASE_URL, async_driver=True),
)
async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_db():
    async with async_session() as session:
        yield session
