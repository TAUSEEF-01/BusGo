from fastapi import APIRouter, Query, Response
from typing import Optional, List
from schemas.schemas import SearchResult
from services.es_svc import ESService
from services.redis_svc import RedisSearchService
from services.inventory_client import InventoryClient
from core.config import settings
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.http_client import ResilientClient

router = APIRouter(tags=["search"])

_op_client = ResilientClient()


@router.post("/reindex")
async def reindex_trips():
    """Re-seed the Elasticsearch trip index from operator-service.

    Trips normally enter ES via `trip.created` Kafka events, so trips that
    already existed (or that were lost when ES was recreated without a volume)
    are missing. This pulls every trip from operator-service and (re)indexes it.
    """
    try:
        data = await _op_client.get_json(f"{settings.OPERATOR_SERVICE_URL}/trips/?limit=1000", timeout=15.0)
        trips = data.get("data", []) if isinstance(data, dict) else []
    except Exception as e:
        return BaseResponse(success=False, message=f"Failed to fetch trips from operator-service: {e}")

    indexed = await ESService.bulk_index_trips(trips)
    # Drop the cached city list so /cities recomputes from the fresh index.
    try:
        await RedisSearchService.delete("search:cities")
    except Exception:
        pass
    return BaseResponse(success=True, data={"indexed": indexed}, message=f"Re-indexed {indexed} trips into Elasticsearch")

@router.get("/buses")
async def search_buses(
    response: Response,
    origin: str,
    destination: str,
    journey_date: str,
    seat_class: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    departure_time_range: Optional[str] = None,
    sort_by: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1)
):
    cache_key = f"search:{origin}:{destination}:{journey_date}"
    cached_res = await RedisSearchService.get(cache_key)
    
    inventory_degraded = False
    
    if cached_res:
        trips = cached_res
    else:
        # Build ES query
        must_clauses = [
            {"term": {"origin_city": origin}},
            {"term": {"destination_city": destination}},
            {"range": {"departure_datetime": {"gte": f"{journey_date}T00:00:00", "lte": f"{journey_date}T23:59:59"}}},
            {"term": {"status": "SCHEDULED"}}
        ]
        
        if seat_class:
            must_clauses.append({"term": {"bus_type": seat_class}})
        if min_price is not None or max_price is not None:
            price_range = {}
            if min_price: price_range["gte"] = min_price
            if max_price: price_range["lte"] = max_price
            must_clauses.append({"range": {"fare_amount": price_range}})
            
        es_query = {"query": {"bool": {"must": must_clauses}}}
        
        if sort_by == "price":
            es_query["sort"] = [{"fare_amount": "asc"}]
        elif sort_by == "departure_time":
            es_query["sort"] = [{"departure_datetime": "asc"}]
            
        es_res = await ESService.search_trips(es_query)
        trips = [hit["_source"] for hit in es_res.get("hits", {}).get("hits", [])]
        
        # Cache initial query from ES
        await RedisSearchService.set(cache_key, trips, 300) # 5 min TTL
        
    # Synchronize with Inventory
    final_results = []
    for trip in trips:
        count, healthy = await InventoryClient.get_available_seats_safe(trip["trip_id"])
        if not healthy:
            inventory_degraded = True
            # Rely on stale ES data
            count = trip.get("available_seats", 0)
            
        trip["available_seats"] = count
        final_results.append(trip)
        
    if inventory_degraded:
        response.headers["X-Inventory-Status"] = "degraded"
        
    # Paginate memory
    start = (page - 1) * page_size
    end = start + page_size
    paged_results = final_results[start:end]
        
    return BaseResponse(success=True, data=paged_results)

@router.get("/cities")
async def get_cities():
    cache_key = "search:cities"
    cached = await RedisSearchService.get(cache_key)
    if cached:
        return BaseResponse(success=True, data=cached)
        
    cities = await ESService.get_cities()
    await RedisSearchService.set(cache_key, cities, 3600) # 1 hour TTL
    return BaseResponse(success=True, data=cities)

@router.get("/buses/{trip_id}")
async def get_trip_details(trip_id: str, response: Response):
    trip = await ESService.get_trip(trip_id)
    if not trip:
        return BaseResponse(success=False, message="Trip not found")
        
    count, healthy = await InventoryClient.get_available_seats_safe(trip_id)
    if not healthy:
        response.headers["X-Inventory-Status"] = "degraded"
        count = trip.get("available_seats", 0)
        
    trip["available_seats"] = count
    return BaseResponse(success=True, data=trip)
