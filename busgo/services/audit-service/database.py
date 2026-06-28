from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from shared.database_config import get_database_url, get_db_connect_args

DATABASE_URL = get_database_url(async_driver=False)
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=get_db_connect_args(DATABASE_URL, async_driver=False))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()





