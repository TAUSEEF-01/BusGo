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
    # Use 6543 (Transaction mode) to support high number of connections
    port = "6543"
    return (
        f"{scheme}://{SUPABASE_DB_USER}:{_ENCODED_PASSWORD}"
        f"@{SUPABASE_DB_HOST}:{port}/{SUPABASE_DB_NAME}"
    )


def get_database_url(*, async_driver: bool = True) -> str:
    """Return DATABASE_URL from the environment, or the Supabase default."""
    return os.getenv("DATABASE_URL", build_database_url(async_driver=async_driver))


def get_db_connect_args(url: str, *, async_driver: bool = True) -> dict:
    """Return appropriate connect_args depending on whether the connection is local or remote."""
    connect_args = {}
    if async_driver:
        connect_args["statement_cache_size"] = 0
        
    is_local = any(host in url for host in ["localhost", "127.0.0.1", "postgres", "::1"])
    db_ssl = os.getenv("DB_SSL", "true").lower() == "true"
    
    if not is_local:
        if async_driver:
            import uuid
            connect_args["prepared_statement_name_func"] = lambda: f"__asyncpg_{uuid.uuid4().hex}__"
            if db_ssl:
                connect_args["ssl"] = "require"
        else:
            if db_ssl:
                connect_args["sslmode"] = "require"
                
    return connect_args

