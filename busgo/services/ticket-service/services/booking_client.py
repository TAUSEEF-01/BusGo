import httpx
from core.config import settings
from typing import Optional, Dict, Any

class BookingClient:
    @staticmethod
    async def get_booking_details(booking_id: str) -> Optional[Dict[str, Any]]:
        # System-to-system call
        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(
                    f"{settings.BOOKING_SERVICE_URL}/bookings/{booking_id}/internal", # Assume internal endpoint bypassing standard auth
                    timeout=10.0
                )
                if res.status_code == 200:
                    return res.json().get("data")
            except Exception as e:
                print(f"Booking fetch error: {e}")
        return None
