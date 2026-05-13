import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from core.config import settings

class InventoryClient:
    @staticmethod
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def get_available_seats(trip_id: str) -> int:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{settings.INVENTORY_SERVICE_URL}/trips/{trip_id}/available-count", timeout=5.0)
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
