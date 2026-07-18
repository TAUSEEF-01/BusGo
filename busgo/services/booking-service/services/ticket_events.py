from datetime import datetime
from typing import Any, Dict

from models.models import Booking
from services.external import ExternalServices


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


async def build_ticket_event(booking: Booking) -> Dict[str, Any]:
    """Build a self-contained event so ticket issuance has no private HTTP dependency."""
    trip = await ExternalServices.get_trip(str(booking.trip_id))
    departure = trip.get("departure_datetime") or (
        f"{_iso(booking.journey_date)}T{_iso(booking.departure_time)}"
    )
    return {
        "booking_id": str(booking.id),
        "user_id": str(booking.user_id),
        "trip_id": str(booking.trip_id),
        "booking": {
            "id": str(booking.id),
            "user_id": str(booking.user_id),
            "trip_id": str(booking.trip_id),
            "seat_numbers": booking.seat_numbers or [],
            "passenger_details": booking.passenger_details or [],
            "origin": trip.get("origin_city") or booking.boarding_point,
            "destination": trip.get("destination_city") or booking.dropping_point,
            "departure_time": departure,
            "boarding_point": booking.boarding_point,
            "dropping_point": booking.dropping_point,
            "operator_name": trip.get("operator_name") or "BusGo operator",
            "bus_type": trip.get("bus_type") or "Bus",
        },
    }
