"""Travel-record helpers.

A travel record is the simple per-user history model the re-marketing feature
reads. We create one whenever a booking is confirmed. Writes are idempotent via
an ON CONFLICT DO NOTHING on the (user_id, trip_id) unique constraint, so a
booking that is confirmed twice (e.g. endpoint + Kafka event) yields one row.
"""
import logging
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models.models import Booking, TravelRecord

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import BookingStatus


async def record_travel(db: AsyncSession, booking: Booking) -> None:
    """Upsert a travel record for a (now confirmed) booking. Never raises."""
    try:
        stmt = pg_insert(TravelRecord.__table__).values(
            user_id=booking.user_id,
            trip_id=booking.trip_id,
            operator_id=booking.operator_id,
            origin=(booking.boarding_point or "").strip(),
            destination=(booking.dropping_point or "").strip(),
            journey_date=booking.journey_date,
        ).on_conflict_do_nothing(constraint="uq_travel_user_trip")
        await db.execute(stmt)
        await db.commit()
    except Exception as e:  # travel history is best-effort — don't break booking flow
        await db.rollback()
        logging.error(f"Failed to record travel for booking {booking.id}: {e}")


async def sync_from_bookings(db: AsyncSession) -> int:
    """Backfill travel records from all CONFIRMED bookings. Idempotent.

    Returns the number of records inserted this run.
    """
    result = await db.execute(
        select(Booking).where(Booking.status == BookingStatus.CONFIRMED)
    )
    bookings = result.scalars().all()
    inserted = 0
    for b in bookings:
        stmt = pg_insert(TravelRecord.__table__).values(
            user_id=b.user_id,
            trip_id=b.trip_id,
            operator_id=b.operator_id,
            origin=(b.boarding_point or "").strip(),
            destination=(b.dropping_point or "").strip(),
            journey_date=b.journey_date,
        ).on_conflict_do_nothing(constraint="uq_travel_user_trip")
        res = await db.execute(stmt)
        inserted += res.rowcount or 0
    await db.commit()
    return inserted
