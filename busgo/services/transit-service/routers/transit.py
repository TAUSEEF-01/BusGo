from datetime import date
import logging

from fastapi import APIRouter, Query

from services.planner import plan
from services.redis_svc import RedisTransitService

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse

router = APIRouter(tags=["transit"])


@router.get("/search", response_model=BaseResponse)
async def search_itineraries(
    origin: str = Query(...),
    destination: str = Query(...),
    journey_date: str = Query(..., description="YYYY-MM-DD"),
):
    """Find connecting (multi-leg) journeys for an origin/destination/date.

    Operator-curated itineraries are ranked first, then auto-discovered ones.
    Public endpoint (no auth), mirroring search-service.
    """
    try:
        jdate = date.fromisoformat(journey_date)
    except ValueError:
        return BaseResponse(success=False, message="journey_date must be YYYY-MM-DD")

    cache_key = f"transit:{origin.strip().lower()}:{destination.strip().lower()}:{journey_date}"
    cached = await RedisTransitService.get(cache_key)
    if cached is not None:
        return BaseResponse(success=True, data=cached)

    try:
        itineraries = await plan(origin, destination, jdate)
    except Exception as e:
        logging.error(f"Transit planning failed: {e}")
        return BaseResponse(
            success=True,
            data={"itineraries": [], "searched": {"origin": origin, "destination": destination, "journey_date": journey_date}},
            message="No itineraries found (is the search index seeded? POST /api/search/reindex).",
        )

    data = {
        "itineraries": itineraries,
        "searched": {"origin": origin, "destination": destination, "journey_date": journey_date},
    }
    await RedisTransitService.set(cache_key, data, 120)
    message = "" if itineraries else "No itineraries found (is the search index seeded? POST /api/search/reindex)."
    return BaseResponse(success=True, data=data, message=message)
