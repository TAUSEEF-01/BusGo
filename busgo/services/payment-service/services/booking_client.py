from core.config import settings
from typing import Optional, Dict, Any
from shared.http_client import ResilientClient

_client = ResilientClient()

class BookingClient:
    @staticmethod
    async def get_booking(booking_id: str, auth_token: str) -> Optional[Dict[str, Any]]:
        headers = {}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        try:
            res = await _client.get(
                f"{settings.BOOKING_SERVICE_URL}/{booking_id}",
                headers=headers,
                timeout=5.0
            )
            if res.status_code == 200:
                return res.json().get("data")
        except Exception as e:
            print(f"Booking fetch error: {e}")
        return None

    @staticmethod
    async def get_journey(journey_id: str, auth_token: str) -> Optional[Dict[str, Any]]:
        """Fetch a transit journey (with total_fare + discount_amount) so the
        fraud check can validate the payment amount against the whole journey."""
        headers = {}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        try:
            res = await _client.get(
                f"{settings.BOOKING_SERVICE_URL}/journeys/{journey_id}",
                headers=headers,
                timeout=5.0,
            )
            if res.status_code == 200:
                return res.json().get("data")
        except Exception as e:
            print(f"Journey fetch error: {e}")
        return None
