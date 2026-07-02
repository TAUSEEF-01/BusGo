from elasticsearch import AsyncElasticsearch
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
    async def bulk_index_trips(cls, trips: list) -> int:
        """Index many trips at once. Ensures the index exists first. Returns the
        number indexed. Used to re-seed ES after the index is lost (ES has no
        persistent volume, so a stack recreate empties it)."""
        await cls.init_index()
        indexed = 0
        for t in trips:
            trip_id = t.get("trip_id") or t.get("id")
            if not trip_id:
                continue
            t["trip_id"] = str(trip_id)
            await es_client.index(index=cls.INDEX_NAME, id=t["trip_id"], document=t)
            indexed += 1
        if indexed:
            await es_client.indices.refresh(index=cls.INDEX_NAME)
        return indexed

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
