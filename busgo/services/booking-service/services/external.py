import logging
from datetime import datetime, timezone
from typing import Optional
from core.config import settings
from shared.http_client import ResilientClient

# Shared resilient client: split timeouts, retries with backoff, per-host
# circuit breaker, and X-Request-ID correlation propagation.
_client = ResilientClient()

class ExternalServices:
    @staticmethod
    async def validate_promo(promo_code: str, fare_amount: float, trip_id: str, user_id: str) -> float:
        # returns discount amount
        if not promo_code: return 0.0
        try:
            res = await _client.post(
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
        res = await _client.post(
            f"{settings.INVENTORY_SERVICE_URL}/trips/{trip_id}/seats/lock",
            json={
                "seat_numbers": seat_numbers,
                "booking_id": booking_id,
                "user_id": user_id
            },
            timeout=30.0  # Increased from 5.0 to 30.0 seconds
        )
        res.raise_for_status()
        return res.json()

    @staticmethod
    async def confirm_seats(trip_id: str, seat_numbers: list, booking_id: str, user_id: str):
        res = await _client.post(
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
        res = await _client.post(
            f"{settings.INVENTORY_SERVICE_URL}/trips/{trip_id}/seats/unbook",
            json={
                "seat_numbers": seat_numbers,
                "booking_id": booking_id
            },
            timeout=5.0
        )
        res.raise_for_status()
        return res.json()

    @staticmethod
    async def get_payment_completed_at(payment_id: str) -> Optional[datetime]:
        if not payment_id or payment_id == "None":
            return None
        try:
            res = await _client.get(
                f"{settings.PAYMENT_SERVICE_URL}/{payment_id}",
                timeout=5.0,
            )
            if res.status_code == 200:
                data = res.json().get("data", {})
                completed_at_str = data.get("completed_at")
                if completed_at_str:
                    dt = datetime.fromisoformat(completed_at_str)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    return dt
        except Exception as e:
            logging.error(f"Failed to fetch payment {payment_id}: {e}")
        return None

    @staticmethod
    async def credit_refund(user_id: str, amount: float, payment_id: str, booking_id: str) -> bool:
        """Fetch payment method then credit refund to the user's account via bank-service."""
        try:
            # Get the payment to find which method was used
            pay_res = await _client.get(f"{settings.PAYMENT_SERVICE_URL}/{payment_id}", timeout=5.0)
            if pay_res.status_code != 200:
                return False
            method = pay_res.json().get("data", {}).get("method")
            if not method:
                return False

            credit_res = await _client.post(
                f"{settings.BANK_SERVICE_URL}/credit",
                json={
                    "user_id": user_id,
                    "amount": amount,
                    "method": method,
                    "reference": booking_id,
                    "description": "Cancellation refund (80%)",
                },
                timeout=8.0,
            )
            return credit_res.status_code == 200 and credit_res.json().get("success", False)
        except Exception as e:
            logging.error(f"Failed to credit refund for booking {booking_id}: {e}")
            return False
