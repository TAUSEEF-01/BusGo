"""Re-marketing / travel-record endpoints.

Idea: every confirmed booking is stored as a *travel record*. When a trip has
empty seats, the operator asks this service which past travellers are most
likely to want that route (a simple scoring algorithm over their travel
records), then sends the selected users a special discounted offer.

Endpoints (all under the /api/bookings prefix via Kong):
  GET  /travel-history/my                        – the caller's own travel record + profile
  POST /travel-records/sync                      – backfill travel records from confirmed bookings
  POST /trips/{trip_id}/interested-passengers    – ranked candidate users for an under-filled trip
  POST /trips/{trip_id}/notify-interested        – create an offer promo + notify selected users
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models.models import Booking, TravelRecord
from api.deps import get_current_user_payload
from services.external import ExternalServices
from services.travel_records import sync_from_bookings

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.enums import BookingStatus

router = APIRouter(tags=["marketing"])


# ── scoring weights for the matching algorithm ──────────────────────────────
W_EXACT = 10      # travelled this exact route (origin→destination) before
W_REVERSE = 6     # travelled the return leg (destination→origin)
W_CORRIDOR = 3    # travelled touching either city (loose corridor match)
W_OPERATOR = 2    # loyalty: travelled with this operator before
W_RECENT_30 = 4   # travelled within the last 30 days
W_RECENT_90 = 2   # travelled within the last 90 days


def _norm(s: Optional[str]) -> str:
    return (s or "").strip().lower()


def _auth_token(request: Request) -> str:
    return request.headers.get("Authorization", "").replace("Bearer ", "")


def _require_operator(payload: dict):
    role = str(payload.get("role", "")).upper()
    if role not in ("OPERATOR", "ADMIN"):
        raise HTTPException(status_code=403, detail="Operator or admin access required")


# ── request models ──────────────────────────────────────────────────────────
class InterestedRequest(BaseModel):
    origin: str
    destination: str
    operator_id: Optional[str] = None
    limit: int = 25


class NotifyRequest(BaseModel):
    user_ids: List[str]
    origin: str
    destination: str
    discount_pct: float = 0
    message: Optional[str] = None
    journey_date: Optional[str] = None


# ── endpoints ────────────────────────────────────────────────────────────────
@router.get("/travel-history/my", response_model=BaseResponse)
async def my_travel_history(db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    """The caller's own travel record + a small profile (top routes, operators)."""
    user_id = payload.get("user_id")
    res = await db.execute(
        select(TravelRecord).where(TravelRecord.user_id == user_id).order_by(TravelRecord.journey_date.desc())
    )
    records = res.scalars().all()

    route_counts: dict = {}
    for r in records:
        key = f"{r.origin} → {r.destination}"
        route_counts[key] = route_counts.get(key, 0) + 1
    top_routes = sorted(route_counts.items(), key=lambda kv: kv[1], reverse=True)

    return BaseResponse(success=True, data={
        "total_trips": len(records),
        "top_routes": [{"route": k, "count": v} for k, v in top_routes[:5]],
        "records": [{
            "trip_id": str(r.trip_id),
            "origin": r.origin,
            "destination": r.destination,
            "journey_date": r.journey_date.isoformat() if r.journey_date else None,
        } for r in records[:50]],
    })


@router.post("/travel-records/sync", response_model=BaseResponse)
async def sync_travel_records(db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    """Backfill travel records from existing confirmed bookings (idempotent)."""
    inserted = await sync_from_bookings(db)
    total = (await db.execute(select(func.count()).select_from(TravelRecord))).scalar()
    return BaseResponse(success=True, data={"inserted": inserted, "total_records": total},
                        message=f"Synced travel records ({inserted} new)")


@router.post("/trips/{trip_id}/interested-passengers", response_model=BaseResponse)
async def interested_passengers(trip_id: UUID, req: InterestedRequest, request: Request,
                                db: AsyncSession = Depends(get_db),
                                payload: dict = Depends(get_current_user_payload)):
    """Rank past travellers by how well their travel record matches this trip's
    route, so the operator can target them with an offer to fill empty seats."""
    _require_operator(payload)
    O, D = _norm(req.origin), _norm(req.destination)
    operator_uuid = None
    if req.operator_id:
        try:
            operator_uuid = UUID(req.operator_id)
        except (ValueError, AttributeError):
            operator_uuid = None

    # Candidate records: anything touching this route or operator.
    conditions = [
        func.lower(TravelRecord.origin) == O,
        func.lower(TravelRecord.destination) == D,
        func.lower(TravelRecord.origin) == D,
        func.lower(TravelRecord.destination) == O,
    ]
    if operator_uuid:
        conditions.append(TravelRecord.operator_id == operator_uuid)
    res = await db.execute(select(TravelRecord).where(or_(*conditions)))
    records = res.scalars().all()

    # Exclude users already on this trip — no point offering them a seat.
    booked_res = await db.execute(
        select(Booking.user_id).where(
            Booking.trip_id == trip_id,
            Booking.status.in_([BookingStatus.SEAT_LOCKED, BookingStatus.CONFIRMED]),
        )
    )
    already_booked = {str(uid) for uid in booked_res.scalars().all()}

    # Group records per user and score them.
    by_user: dict = {}
    for r in records:
        uid = str(r.user_id)
        if uid in already_booked:
            continue
        by_user.setdefault(uid, []).append(r)

    today = datetime.now(timezone.utc).date()
    candidates = []
    for uid, recs in by_user.items():
        score = 0
        exact = reverse = corridor = op_match = 0
        last_date = None
        for r in recs:
            o, d = _norm(r.origin), _norm(r.destination)
            if o == O and d == D:
                score += W_EXACT; exact += 1
            elif o == D and d == O:
                score += W_REVERSE; reverse += 1
            elif o in (O, D) or d in (O, D):
                score += W_CORRIDOR; corridor += 1
            if operator_uuid and r.operator_id == operator_uuid:
                score += W_OPERATOR; op_match += 1
            if r.journey_date and (last_date is None or r.journey_date > last_date):
                last_date = r.journey_date

        if last_date:
            days = (today - last_date).days
            if days <= 30:
                score += W_RECENT_30
            elif days <= 90:
                score += W_RECENT_90

        reasons = []
        if exact:
            reasons.append(f"Travelled {req.origin} → {req.destination} {exact}× before")
        if reverse:
            reasons.append(f"Travelled the return {req.destination} → {req.origin} {reverse}×")
        if corridor:
            reasons.append(f"Frequently travels via {req.origin}/{req.destination}")
        if op_match:
            reasons.append(f"Booked with your service {op_match}×")
        if last_date and (today - last_date).days <= 30:
            reasons.append("Recent traveller")

        candidates.append({
            "user_id": uid,
            "score": score,
            "total_trips": len(recs),
            "trips_on_route": exact,
            "last_travelled": last_date.isoformat() if last_date else None,
            "reasons": reasons,
        })

    candidates.sort(key=lambda c: c["score"], reverse=True)
    candidates = candidates[: max(1, min(req.limit, 100))]

    # Enrich with names/phone (best effort).
    names = await ExternalServices.lookup_user_names([c["user_id"] for c in candidates], _auth_token(request))
    for c in candidates:
        info = names.get(c["user_id"], {})
        c["name"] = info.get("full_name") or "Passenger"
        c["phone"] = info.get("phone")

    occupancy = await ExternalServices.get_trip_occupancy(str(trip_id))

    return BaseResponse(success=True, data={
        "trip_id": str(trip_id),
        "route": f"{req.origin} → {req.destination}",
        "occupancy": occupancy,
        "candidate_count": len(candidates),
        "candidates": candidates,
    })


@router.post("/trips/{trip_id}/notify-interested", response_model=BaseResponse)
async def notify_interested(trip_id: UUID, req: NotifyRequest, request: Request,
                            db: AsyncSession = Depends(get_db),
                            payload: dict = Depends(get_current_user_payload)):
    """Create a special offer (promo code) and notify the selected users."""
    _require_operator(payload)
    if not req.user_ids:
        raise HTTPException(status_code=400, detail="Select at least one passenger to notify")

    token = _auth_token(request)
    operator_id = payload.get("user_id")
    route = f"{req.origin} → {req.destination}"

    # Create a percentage promo code for the offer, if a discount was set.
    promo_code = None
    if req.discount_pct and req.discount_pct > 0:
        promo_code = f"FILL{_norm(req.origin)[:3].upper()}{uuid.uuid4().hex[:4].upper()}"
        # Offer valid until the journey date (or 7 days out as a fallback).
        valid_until = (datetime.now(timezone.utc) + timedelta(days=7))
        if req.journey_date:
            try:
                valid_until = datetime.fromisoformat(req.journey_date)
            except ValueError:
                pass
        created = await ExternalServices.create_offer_promo(
            code=promo_code,
            discount_pct=float(req.discount_pct),
            operator_id=str(operator_id) if operator_id else "",
            valid_until=valid_until.isoformat(),
            max_uses=max(len(req.user_ids), 1),
            title=f"{int(req.discount_pct)}% off {route}",
            description=f"Special offer to fill seats on {route}",
        )
        if not created:
            promo_code = None  # promo failed; still send the notification below

    # Compose the message.
    if req.message and req.message.strip():
        message = req.message.strip()
    else:
        disc = f" Enjoy {int(req.discount_pct)}% off" if promo_code else " Special fares available"
        message = f"Seats just opened on {route}!{disc}. Book now before they're gone."
    if promo_code:
        message += f" Use code {promo_code} at checkout."

    metadata = {
        "offer": True,
        "trip_id": str(trip_id),
        "route": route,
        "origin": req.origin,
        "destination": req.destination,
        "discount_pct": req.discount_pct,
        "promo_code": promo_code,
    }

    sent = await ExternalServices.send_offer_notifications(
        user_ids=req.user_ids,
        title="🎟️ Special Offer — Seats Available!",
        message=message,
        metadata=metadata,
        auth_token=token,
    )

    return BaseResponse(success=True, data={
        "notified": sent,
        "promo_code": promo_code,
        "discount_pct": req.discount_pct,
    }, message=f"Notified {sent} passenger(s)")
