#!/usr/bin/env python3
"""Test Supabase PostgreSQL connectivity for BusGo services."""
from __future__ import annotations

import asyncio
import sys
from urllib.parse import quote_plus

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

PASSWORD = "BusGoLet'sGo"
ENCODED_PASSWORD = quote_plus(PASSWORD)
PROJECT_REF = "wtldkwqnfynxfqyqvehy"

REGIONS = [
    "ap-south-1",
    "ap-southeast-1",
    "ap-northeast-1",
    "us-east-1",
    "us-west-1",
    "eu-west-1",
    "eu-central-1",
    "sa-east-1",
]

CANDIDATES: list[tuple[str, str, dict]] = [
    (
        "direct-ipv6",
        f"postgresql+asyncpg://postgres:{ENCODED_PASSWORD}@db.{PROJECT_REF}.supabase.co:5432/postgres",
        {},
    ),
    (
        "transaction-pooler-db-host",
        f"postgresql+asyncpg://postgres:{ENCODED_PASSWORD}@db.{PROJECT_REF}.supabase.co:6543/postgres",
        {"ssl": "require"},
    ),
]

for region in REGIONS:
    host = f"aws-0-{region}.pooler.supabase.com"
    CANDIDATES.append(
        (
            f"session-pooler-{region}",
            f"postgresql+asyncpg://postgres.{PROJECT_REF}:{ENCODED_PASSWORD}@{host}:5432/postgres",
            {"ssl": "require"},
        )
    )
    CANDIDATES.append(
        (
            f"tx-pooler-{region}",
            f"postgresql+asyncpg://postgres.{PROJECT_REF}:{ENCODED_PASSWORD}@{host}:6543/postgres",
            {"ssl": "require"},
        )
    )


async def try_connect(name: str, url: str, connect_args: dict) -> bool:
    print(f"[{name}]")
    try:
        engine = create_async_engine(url, connect_args=connect_args)
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
        print(f"  OK  tables={table_count}  version={str(version)[:60]}...")
        return True
    except Exception as exc:
        print(f"  FAIL  {type(exc).__name__}: {exc}")
        return False


async def main() -> int:
    print("BusGo Supabase connection probe\n")
    working: list[str] = []
    for name, url, connect_args in CANDIDATES:
        if await try_connect(name, url, connect_args):
            working.append(name)
    print("\nSummary")
    if working:
        print(f"Working endpoints: {', '.join(working)}")
        return 0
    print("No working endpoints found.")
    print("Direct host is IPv6-only; enable IPv6 or use the session pooler URL from the Supabase dashboard.")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
