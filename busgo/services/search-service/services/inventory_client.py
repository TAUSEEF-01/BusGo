from core.config import settings
from shared.http_client import ResilientClient

# Resilient client centralises retries/backoff, circuit breaking and correlation.
_client = ResilientClient()

class InventoryClient:
    @staticmethod
    async def get_available_seats(trip_id: str) -> int:
        data = await _client.get_json(
            f"{settings.INVENTORY_SERVICE_URL}/trips/{trip_id}/available-count",
            timeout=5.0,
        )
        return data.get("data", {}).get("available_seats", 0)

    @staticmethod
    async def get_available_seats_safe(trip_id: str):
        try:
            count = await InventoryClient.get_available_seats(trip_id)
            return count, True
        except Exception as e:
            print(f"Inventory call failed after retries: {e}")
            return None, False
