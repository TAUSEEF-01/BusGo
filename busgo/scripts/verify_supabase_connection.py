#!/usr/bin/env python3
"""Verify connectivity to the BusGo Supabase PostgreSQL database."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine

from shared.database_config import build_database_url, get_database_url


async def verify_async(url: str) -> bool:
    print("Async driver (asyncpg):")
    print(f"  URL host: {url.split('@')[-1]}")
    try:
        engine = create_async_engine(url, connect_args={"ssl": "require"})
        async with engine.connect() as conn:
            version = (await conn.execute(text("SELECT version()"))).scalar()
            table_count = (
                await conn.execute(
                    text(
                        "SELECT COUNT(*) FROM information_schema.tables "
                        "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
                    )
                )
            ).scalar()
        await engine.dispose()
        print(f"  OK  PostgreSQL connected ({table_count} public tables)")
        print(f"  {str(version)[:80]}...")
        return True
    except Exception as exc:
        print(f"  FAIL  {type(exc).__name__}: {exc}")
        return False


def verify_sync(url: str) -> bool:
    print("Sync driver (psycopg2):")
    print(f"  URL host: {url.split('@')[-1]}")
    try:
        engine = create_engine(url, connect_args={"sslmode": "require"})
        with engine.connect() as conn:
            version = conn.execute(text("SELECT version()")).scalar()
            table_count = conn.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
                )
            ).scalar()
        print(f"  OK  PostgreSQL connected ({table_count} public tables)")
        print(f"  {str(version)[:80]}...")
        return True
    except Exception as exc:
        print(f"  FAIL  {type(exc).__name__}: {exc}")
        return False


async def main() -> int:
    print("BusGo Supabase connection verification\n")
    async_url = get_database_url(async_driver=True)
    sync_url = get_database_url(async_driver=False).replace("+asyncpg", "")

    async_ok = await verify_async(async_url)
    print()
    sync_ok = verify_sync(sync_url)

    print("\nConfigured default (no DATABASE_URL env):")
    print(f"  {build_database_url(async_driver=True).split('@')[-1]}")

    if async_ok and sync_ok:
        print("\nAll connection checks passed.")
        return 0

    print("\nConnection checks failed.")
    print("The direct Supabase host (db.*.supabase.co) is IPv6-only.")
    print("If you are on IPv4-only networks, copy the Session pooler URL from:")
    print("  Supabase Dashboard -> Connect -> Session mode")
    print("Set it as DATABASE_URL for all services, then rerun this script.")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
