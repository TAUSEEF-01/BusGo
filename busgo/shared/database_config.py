"""Shared Supabase PostgreSQL connection settings for BusGo services."""
import os
from urllib.parse import quote_plus

SUPABASE_PROJECT_REF = "wtldkwqnfynxfqyqvehy"
SUPABASE_DB_HOST = "aws-1-ap-northeast-1.pooler.supabase.com"
SUPABASE_DB_NAME = "postgres"
SUPABASE_DB_USER = f"postgres.{SUPABASE_PROJECT_REF}"
SUPABASE_DB_PASSWORD = os.getenv("SUPABASE_DB_PASSWORD", "BusGoLet'sGo")

_ENCODED_PASSWORD = quote_plus(SUPABASE_DB_PASSWORD)


def build_database_url(*, async_driver: bool = True) -> str:
    scheme = "postgresql+asyncpg" if async_driver else "postgresql"
    # Use 5432 (Session mode) for both since asyncpg uses prepared statements
    port = "5432"
    return (
        f"{scheme}://{SUPABASE_DB_USER}:{_ENCODED_PASSWORD}"
        f"@{SUPABASE_DB_HOST}:{port}/{SUPABASE_DB_NAME}"
    )


def get_database_url(*, async_driver: bool = True) -> str:
    """Return DATABASE_URL from the environment, or the Supabase default."""
    return os.getenv("DATABASE_URL", build_database_url(async_driver=async_driver))
