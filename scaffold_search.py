import os

base_dir = "busgo/services/search-service"
os.makedirs(f"{base_dir}/core", exist_ok=True)
os.makedirs(f"{base_dir}/api", exist_ok=True)
os.makedirs(f"{base_dir}/schemas", exist_ok=True)
os.makedirs(f"{base_dir}/services", exist_ok=True)
os.makedirs(f"{base_dir}/routers", exist_ok=True)

with open(f"{base_dir}/requirements.txt", "a") as f:
    f.write("redis\nelasticsearch[async]\naiokafka\nhttpx\ntenacity\n")

with open(f"{base_dir}/core/config.py", "w") as f:
    f.write(
        """import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ELASTICSEARCH_URL: str = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/2")
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    INVENTORY_SERVICE_URL: str = os.getenv("INVENTORY_SERVICE_URL", "http://inventory-service:8000")

settings = Settings()
"""
    )

with open(f"{base_dir}/schemas/schemas.py", "w") as f:
    f.write(
        """from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime
from uuid import UUID

class Point(BaseModel):
    name: str # e.g., location name

class TripDocument(BaseModel):
    trip_id: str
    operator_id: str
    operator_name: str
    bus_type: str
    origin_city: str
    destination_city: str
    departure_datetime: str
    arrival_datetime: str
    fare_amount: float
    available_seats: int
    boarding_points: List[Point] = []
    amenities: List[str] = []
    status: str

class SearchResult(BaseModel):
    trip_id: str
    operator_name: str
    bus_type: str
    origin_city: str
    destination_city: str
    departure_datetime: str
    arrival_datetime: str
    fare_amount: float
    available_seats: int
    matched_amenities: List[str] = []
"""
    )

with open(f"{base_dir}/services/es_svc.py", "w") as f:
    f.write(
        """from elasticsearch import AsyncElasticsearch
from core.config import settings

es_client = AsyncElasticsearch(settings.ELASTICSEARCH_URL)

class ESService:
    INDEX_NAME = "bus_trips"

    @classmethod
    async def init_index(cls):
        exists = await es_client.indices.exists(index=cls.INDEX_NAME)
        if not exists:
            mapping = {
                "mappings": {
                    "properties": {
                        "trip_id": {"type": "keyword"},
                        "operator_id": {"type": "keyword"},
                        "operator_name": {"type": "text"},
                        "bus_type": {"type": "keyword"},
                        "origin_city": {"type": "keyword"},
                        "destination_city": {"type": "keyword"},
                        "departure_datetime": {"type": "date"},
                        "arrival_datetime": {"type": "date"},
                        "fare_amount": {"type": "double"},
                        "available_seats": {"type": "integer"},
                        "status": {"type": "keyword"}
                    }
                }
            }
            await es_client.indices.create(index=cls.INDEX_NAME, body=mapping)

    @classmethod
    async def index_trip(cls, trip_data: dict):
        await es_client.index(index=cls.INDEX_NAME, id=trip_data['trip_id'], document=trip_data)

    @classmethod
    async def update_trip(cls, trip_id: str, update_data: dict):
        await es_client.update(index=cls.INDEX_NAME, id=trip_id, doc=update_data)
        
    @classmethod
    async def search_trips(cls, query: dict):
        return await es_client.search(index=cls.INDEX_NAME, body=query, size=100)

    @classmethod
    async def get_trip(cls, trip_id: str):
        try:
            res = await es_client.get(index=cls.INDEX_NAME, id=trip_id)
            return res.get("_source")
        except Exception:
            return None

    @classmethod
    async def get_cities(cls):
        query = {
            "size": 0,
            "aggs": {
                "origins": {"terms": {"field": "origin_city", "size": 100}},
                "destinations": {"terms": {"field": "destination_city", "size": 100}}
            }
        }
        res = await es_client.search(index=cls.INDEX_NAME, body=query)
        origins = [b['key'] for b in res['aggregations']['origins']['buckets']]
        destinations = [b['key'] for b in res['aggregations']['destinations']['buckets']]
        return list(set(origins + destinations))
"""
    )

with open(f"{base_dir}/services/redis_svc.py", "w") as f:
    f.write(
        """import json
import redis.asyncio as aioredis
from core.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

class RedisSearchService:
    @staticmethod
    async def get(key: str):
        data = await redis_client.get(key)
        return json.loads(data) if data else None

    @staticmethod
    async def set(key: str, value: dict, ttl: int):
        await redis_client.setex(key, ttl, json.dumps(value))
"""
    )

with open(f"{base_dir}/services/inventory_client.py", "w") as f:
    f.write(
        """import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from core.config import settings

class InventoryClient:
    @staticmethod
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def get_available_seats(trip_id: str) -> int:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{settings.INVENTORY_SERVICE_URL}/inventory/trips/{trip_id}/available-count", timeout=5.0)
            resp.raise_for_status()
            data = resp.json().get("data", {})
            return data.get("available_seats", 0)

    @staticmethod
    async def get_available_seats_safe(trip_id: str):
        try:
            count = await InventoryClient.get_available_seats(trip_id)
            return count, True
        except Exception as e:
            print(f"Inventory call failed after retries: {e}")
            return None, False
"""
    )

with open(f"{base_dir}/services/kafka_consumer.py", "w") as f:
    f.write(
        """import json
import asyncio
from aiokafka import AIOKafkaConsumer
from core.config import settings
from services.es_svc import ESService

class SearchKafkaConsumer:
    def __init__(self):
        self.consumer = AIOKafkaConsumer(
            "trip.created", "trip.updated", "trip.cancelled",
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id="search-service-group",
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )

    async def start(self):
        await self.consumer.start()
        asyncio.create_task(self.consume())

    async def stop(self):
        await self.consumer.stop()

    async def consume(self):
        try:
            async for msg in self.consumer:
                await self.process_message(msg.topic, msg.value)
        except Exception as e:
            print(f"Consumer error: {e}")

    async def process_message(self, topic: str, message: dict):
        trip_id = message.get("id") or message.get("trip_id")
        if not trip_id: return

        if topic == "trip.created":
            await ESService.index_trip(message)
        elif topic == "trip.updated":
            await ESService.update_trip(trip_id, message)
        elif topic == "trip.cancelled":
            await ESService.update_trip(trip_id, {"status": "CANCELLED"})
        print(f"Processed {topic} for trip {trip_id} into ES")
"""
    )

with open(f"{base_dir}/routers/search.py", "w") as f:
    f.write(
        """from fastapi import APIRouter, Query, Response
from typing import Optional, List
from schemas.schemas import SearchResult
from services.es_svc import ESService
from services.redis_svc import RedisSearchService
from services.inventory_client import InventoryClient
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse

router = APIRouter(prefix="/search", tags=["search"])

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
"""
    )

with open(f"{base_dir}/main.py", "w") as f:
    f.write(
        """from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.search import router as search_router
from services.es_svc import ESService
from services.kafka_consumer import SearchKafkaConsumer
import sys
import os

app = FastAPI(title="Search Service")
kafka_consumer = SearchKafkaConsumer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(search_router)

@app.on_event("startup")
async def startup():
    try:
        await ESService.init_index()
    except Exception as e:
        print(f"ES Init Error: {e}")
    await kafka_consumer.start()

@app.on_event("shutdown")
async def shutdown():
    await kafka_consumer.stop()

@app.get("/")
async def root():
    return {"message": "Search service is running"}
"""
    )

print("Search Scaffold Done")
