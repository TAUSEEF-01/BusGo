from core.config import settings
from typing import Optional, Dict, Any
from shared.http_client import ResilientClient

_client = ResilientClient()

class BookingClient:
    @staticmethod
    async def get_booking_details(booking_id: str) -> Optional[Dict[str, Any]]:
        # System-to-system call
        try:
            res = await _client.get(
                f"{settings.BOOKING_SERVICE_URL}/bookings/{booking_id}/internal",  # Assume internal endpoint bypassing standard auth
                timeout=10.0
            )
            if res.status_code == 200:
                return res.json().get("data")
        except Exception as e:
            print(f"Booking fetch error: {e}")
        return None
