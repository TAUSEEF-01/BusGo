from elasticsearch import AsyncElasticsearch
from core.config import settings

es_client = AsyncElasticsearch(settings.ELASTICSEARCH_URL)
INDEX = "bus_trips"


async def fetch_trips(date_from_iso: str, date_to_iso: str) -> list[dict]:
    """All SCHEDULED trips departing in [date_from, date_to]. Size 1000.

    The bus_trips index is owned by search-service. If it is missing (ES has no
    persistent volume, so a stack recreate empties it), re-seed with
    POST /api/search/reindex.
    """
    query = {
        "query": {"bool": {"must": [
            {"term": {"status": "SCHEDULED"}},
            {"range": {"departure_datetime": {"gte": date_from_iso, "lte": date_to_iso}}},
        ]}},
        "size": 1000,
    }
    res = await es_client.search(index=INDEX, body=query)
    return [h["_source"] for h in res.get("hits", {}).get("hits", [])]
