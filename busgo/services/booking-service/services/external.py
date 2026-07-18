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
    async def validate_promo(promo_code: str, fare_amount: float, trip_id: str, user_id: str) -> dict:
        """Validate a promo against deals-service and return its outcome.

        Returns {"valid": bool, "discount_amount": float, "message": str}.
        deals-service returns the ValidatePromoResponse at the top level (it is
        NOT wrapped in a {"data": ...} envelope), so we read the fields directly.
        """
        result = {"valid": False, "discount_amount": 0.0, "message": "No promo applied"}
        if not promo_code:
            return result
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
                body = res.json()
                # Support both raw and {"data": ...}-wrapped shapes defensively.
                data = body.get("data", body) if isinstance(body, dict) else {}
                return {
                    "valid": bool(data.get("valid", False)),
                    "discount_amount": float(data.get("discount_amount", 0.0) or 0.0),
                    "message": data.get("message", ""),
                }
        except Exception as e:
            logging.error(f"Promo validation failed for code {promo_code}: {e}")
        return result

    @staticmethod
    async def consume_promo(promo_code: str, user_id: str) -> bool:
        """Mark a promo as used by this user (one-use enforcement + decrement the
        promo's remaining-uses counter). Called once payment is confirmed."""
        if not promo_code:
            return False
        try:
            res = await _client.post(
                f"{settings.DEALS_SERVICE_URL}/apply-promo",
                json={"code": promo_code, "user_id": user_id},
                timeout=5.0,
            )
            return res.status_code == 200
        except Exception as e:
            logging.error(f"Failed to consume promo {promo_code} for user {user_id}: {e}")
            return False

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
    async def get_transit_route(transit_route_id: str, origin: str, destination: str) -> dict:
        """Fetch an operator's curated transit route by id (matched within the
        origin/destination result set). Returns {} if not found/unavailable."""
        if not transit_route_id:
            return {}
        try:
            res = await _client.get(
                f"{settings.OPERATOR_SERVICE_URL}/transit-routes/",
                params={"origin": origin, "destination": destination},
                timeout=6.0,
            )
            if res.status_code == 200:
                for r in res.json().get("data", []) or []:
                    if str(r.get("id")) == str(transit_route_id):
                        return r
        except Exception as e:
            logging.error(f"Failed to fetch transit route {transit_route_id}: {e}")
        return {}

    @staticmethod
    async def get_trip(trip_id: str) -> dict:
        """Fetch authoritative trip, route, bus and fare data."""
        try:
            res = await _client.get(
                f"{settings.OPERATOR_SERVICE_URL}/trips/{trip_id}",
                timeout=6.0,
            )
            if res.status_code == 200:
                return res.json().get("data", {}) or {}
        except Exception as e:
            logging.error(f"Failed to fetch trip {trip_id}: {e}")
        return {}

    @staticmethod
    async def get_trip_occupancy(trip_id: str) -> dict:
        """Return seat occupancy for a trip from inventory-service:
        {total, booked, locked, available}. Empty dict if unavailable."""
        try:
            res = await _client.get(
                f"{settings.INVENTORY_SERVICE_URL}/trips/{trip_id}/seats",
                timeout=6.0,
            )
            if res.status_code == 200:
                seats = res.json().get("data", []) or []
                counts = {"total": len(seats), "booked": 0, "locked": 0, "available": 0}
                for s in seats:
                    st = str(s.get("status", "")).upper()
                    if st == "BOOKED":
                        counts["booked"] += 1
                    elif st == "LOCKED":
                        counts["locked"] += 1
                    else:
                        counts["available"] += 1
                return counts
        except Exception as e:
            logging.error(f"Failed to fetch occupancy for trip {trip_id}: {e}")
        return {}

    @staticmethod
    async def lookup_user_names(user_ids: list, auth_token: str) -> dict:
        """Map user_id -> {full_name, phone, email} via auth-service. Best effort."""
        if not user_ids:
            return {}
        headers = {"Authorization": f"Bearer {auth_token}"} if auth_token else {}
        try:
            res = await _client.post(
                f"{settings.AUTH_SERVICE_URL}/users/lookup",
                json={"user_ids": user_ids},
                headers=headers,
                timeout=6.0,
            )
            if res.status_code == 200:
                return {u["id"]: u for u in res.json().get("data", [])}
        except Exception as e:
            logging.error(f"User name lookup failed: {e}")
        return {}

    @staticmethod
    async def create_offer_promo(code: str, discount_pct: float, operator_id: str,
                                 valid_until: str, max_uses: int, title: str, description: str) -> bool:
        """Create a percentage promo code in deals-service for a re-marketing offer."""
        try:
            res = await _client.post(
                f"{settings.DEALS_SERVICE_URL}/promos/",
                json={
                    "code": code,
                    "discount_type": "PERCENTAGE",
                    "discount_value": discount_pct,
                    "min_fare": 0,
                    "valid_from": datetime.now(timezone.utc).isoformat(),
                    "valid_until": valid_until,
                    "max_uses": max_uses,
                    "operator_id": operator_id,
                    "title": title,
                    "description": description,
                },
                timeout=6.0,
            )
            return res.status_code in (200, 201)
        except Exception as e:
            logging.error(f"Failed to create offer promo {code}: {e}")
            return False

    @staticmethod
    async def send_offer_notifications(user_ids: list, title: str, message: str,
                                       metadata: dict, auth_token: str) -> int:
        """Send an in-app offer notification to users via notification-service.
        Forwards the operator's token so notification-service authorises the send."""
        headers = {"Authorization": f"Bearer {auth_token}"} if auth_token else {}
        try:
            res = await _client.post(
                f"{settings.NOTIFICATION_SERVICE_URL}/send",
                json={
                    "user_ids": user_ids,
                    "type": "OPERATOR_TO_USER",
                    "title": title,
                    "message": message,
                    "metadata": metadata,
                },
                headers=headers,
                timeout=8.0,
            )
            if res.status_code == 200:
                return res.json().get("data", {}).get("sent_count", 0)
            logging.error(f"notification /send returned {res.status_code}: {res.text}")
        except Exception as e:
            logging.error(f"Failed to send offer notifications: {e}")
        return 0

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
