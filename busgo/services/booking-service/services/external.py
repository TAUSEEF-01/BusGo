import httpx
from core.config import settings

class ExternalServices:
    @staticmethod
    async def validate_promo(promo_code: str, fare_amount: float, trip_id: str, user_id: str) -> float:
        # returns discount amount
        if not promo_code: return 0.0
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    f"{settings.DEALS_SERVICE_URL}/validate-promo", 
                    json={
                        "code": promo_code, 
                        "fare_amount": fare_amount,
                        "trip_id": trip_id,
                        "user_id": user_id
                    },
                    timeout=5.0
                )
                if res.status_code == 200:
                    return res.json().get("data", {}).get("discount_amount", 0.0)
        except Exception:
            pass
        return 0.0

    @staticmethod
    async def lock_seats(trip_id: str, seat_numbers: list, booking_id: str, user_id: str):
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{settings.INVENTORY_SERVICE_URL}/trips/{trip_id}/seats/lock",
                json={
                    "seat_numbers": seat_numbers,
                    "booking_id": booking_id,
                    "user_id": user_id
                },
                timeout=5.0
            )
            res.raise_for_status()
            return res.json()

    @staticmethod
    async def confirm_seats(trip_id: str, seat_numbers: list, booking_id: str, user_id: str):
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{settings.INVENTORY_SERVICE_URL}/trips/{trip_id}/seats/confirm",
                json={
                    "seat_numbers": seat_numbers,
                    "booking_id": booking_id,
                    "user_id": user_id
                },
                timeout=5.0
            )
            res.raise_for_status()
            return res.json()

    @staticmethod
    async def unbook_seats(trip_id: str, seat_numbers: list, booking_id: str):
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{settings.INVENTORY_SERVICE_URL}/trips/{trip_id}/seats/unbook",
                json={
                    "seat_numbers": seat_numbers,
                    "booking_id": booking_id
                },
                timeout=5.0
            )
            res.raise_for_status()
            return res.json()
