import json
import logging
import requests
from kafka import KafkaConsumer
from sqlalchemy.orm import Session
from datetime import datetime
import threading
import sys
import os

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from database import SessionLocal
from models import NotificationLog, NotificationChannel, NotificationStatus, InAppNotification
from handlers import send_email, send_sms, send_push, send_whatsapp
from notification_types import NotificationType, get_notification_title

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOOKING_SERVICE_URL = os.getenv(
    "BOOKING_SERVICE_URL",
    "https://busgo-nhbi.onrender.com/api/bookings",
)

ADMIN_SERVICE_URL = os.getenv(
    "ADMIN_SERVICE_URL",
    "https://busgo-nhbi.onrender.com/api/admin",
)

TOPIC_TEMPLATE_MAP = {
    "ticket.issued": "ticket_issued",
    "booking.created": "booking_confirmed",
    "booking.confirmed": "booking_confirmed",
    "booking.cancelled": "booking_cancelled",
    "seat.lock.expired": "booking_cancelled",
    "trip.schedule_changed": "schedule_changed",
    "trip.delayed": "bus_delayed",
    "operator.booking_alert": "operator_new_booking",
    "operator.daily_summary": "operator_daily_summary",
    "operator.revenue_summary": "operator_revenue_summary",
    "operator.route_update": "operator_route_update",
    "admin.new_operator": "admin_new_operator",
    "admin.new_user": "admin_new_user",
    "admin.system_alert": "admin_system_alert",
    "admin.daily_summary": "admin_daily_summary",
    "admin.complaint": "admin_user_complaint",
    "admin.revenue_report": "admin_revenue_report",
}

def _extract_data(event: dict) -> dict:
    data = event.get("data")
    if isinstance(data, dict) and data:
        return data

    ignored_keys = {
        "template",
        "type",
        "user_id",
        "recipient_id",
        "phone",
        "email",
        "fcm_token",
        "subject",
        "attachments",
        "channel",
    }
    return {key: value for key, value in event.items() if key not in ignored_keys}


def _safe_request_json(url: str):
    try:
        response = requests.get(url, timeout=5)
        if response.status_code != 200:
            logger.info(f"[IN-APP] Booking lookup returned {response.status_code} for {url}")
            return None

        payload = response.json()
        if isinstance(payload, dict):
            return payload.get("data", payload)
        return payload
    except Exception as exc:
        logger.info(f"[IN-APP] Booking lookup failed for {url}: {exc}")
        return None


def _fetch_trip_bookings(trip_id: str):
    if not trip_id:
        return []

    bookings = _safe_request_json(f"{BOOKING_SERVICE_URL}/trip/{trip_id}")
    return bookings if isinstance(bookings, list) else []


def _find_booking_context(event: dict, data: dict):
    trip_id = data.get("trip_id") or event.get("trip_id")
    booking_id = data.get("booking_id") or event.get("booking_id")
    bookings = _fetch_trip_bookings(trip_id) if trip_id else []
    booking = None

    if bookings and booking_id:
        for item in bookings:
            if str(item.get("id")) == str(booking_id):
                booking = item
                break

    if booking is None and bookings:
        booking = bookings[0]

    return booking, bookings


def _booking_route_text(booking: dict | None, data: dict) -> str:
    origin = data.get("origin") or data.get("boarding_point")
    destination = data.get("destination") or data.get("dest") or data.get("dropping_point")
    if not origin and booking:
        origin = booking.get("boarding_point")
    if not destination and booking:
        destination = booking.get("dropping_point")
    if origin and destination:
        return f"{origin} → {destination}"
    return data.get("route_name") or data.get("route") or "your trip"


def _booking_time_text(booking: dict | None, data: dict) -> str:
    date_value = data.get("date") or data.get("time") or data.get("new_departure_time") or data.get("departure_time")
    if not date_value and booking:
        date_value = booking.get("journey_date") or booking.get("departure_time")
    return str(date_value) if date_value else "soon"


def _booking_seats_text(booking: dict | None, data: dict) -> str:
    seats = data.get("seats") or data.get("seat_numbers") or data.get("seats_booked")
    if seats is None and booking:
        seats = booking.get("seat_numbers")
    if isinstance(seats, list):
        return ", ".join(str(seat) for seat in seats)
    return str(seats) if seats is not None else ""


def _fetch_admin_ids():
    users = _safe_request_json(f"{ADMIN_SERVICE_URL}/users")
    if not isinstance(users, list):
        return []

    admin_ids = []
    for user in users:
        if str(user.get("role", "")).upper() == "ADMIN" and user.get("id"):
            admin_ids.append(str(user["id"]))
    return admin_ids


# ---------------------------------------------------------------------------
# Helper: persist an in-app notification to the database
# ---------------------------------------------------------------------------

def create_in_app_notification(
    db,
    user_id: str,
    role: str,
    notification_type: NotificationType,
    message: str,
    metadata: dict = None,
):
    """
    Persist an in-app notification record.
    Called alongside (or instead of) outbound SMS/Email to give the
    user something to read in their notification centre.
    """
    try:
        title = get_notification_title(notification_type.value)
        notif = InAppNotification(
            user_id=user_id,
            role=role,
            type=notification_type,
            title=title,
            message=message,
            meta_data=metadata or {},
            is_read=False,
        )
        db.add(notif)
        db.commit()
        logger.info(f"[IN-APP] Created notification '{notification_type}' for user {user_id}")
    except Exception as e:
        logger.error(f"[IN-APP] Failed to create notification: {e}")
        db.rollback()


def process_notification(topic: str, event: dict):
    template = event.get("template") or TOPIC_TEMPLATE_MAP.get(topic)
    data = _extract_data(event)
    user_id = event.get("user_id") or event.get("recipient_id") or data.get("user_id")
    phone = event.get("phone") or data.get("phone")
    email = event.get("email") or data.get("email")
    fcm_token = event.get("fcm_token") or data.get("fcm_token")
    booking_record, trip_bookings = _find_booking_context(event, data)
    operator_id = data.get("operator_id") or (booking_record or {}).get("operator_id")
    admin_id = data.get("admin_id") or event.get("admin_id")
    admin_recipients = [str(admin_id)] if admin_id else _fetch_admin_ids()

    # Some legacy delivery events (especially ticket-issued email delivery)
    # should not create a second in-app ticket notification.
    create_ticket_in_app = not (topic == "notification.send" and template == "ticket_issued")

    db: Session = SessionLocal()

    def log_and_send(channel, send_func, *args, **kwargs):
        template_name = (
            template if channel != NotificationChannel.EMAIL else f"{template}_email"
        )
        log = NotificationLog(
            user_id=user_id,
            channel=channel,
            template_name=template_name,
            payload=data,
            status=NotificationStatus.PENDING,
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        try:
            res = send_func(*args, **kwargs)
            if isinstance(res, dict) and res.get("status") == "SENT":
                log.status = NotificationStatus.SENT
                log.sent_at = datetime.utcnow()
            else:
                log.status = NotificationStatus.FAILED
                log.error_message = res.get("error", "Unknown error")
        except Exception as e:
            log.status = NotificationStatus.FAILED
            log.error_message = str(e)

        db.commit()

    if template == "booking_confirmed" and topic == "notification.send":
        route_text = _booking_route_text(booking_record, data)
        time_text = _booking_time_text(booking_record, data)
        seats_text = _booking_seats_text(booking_record, data)
        if phone:
            msg = f"BusGo: Booking confirmed! Ref: {data.get('booking_id')}. {route_text} on {time_text}. Seat(s): {seats_text}"
            log_and_send(NotificationChannel.SMS, send_sms, phone, msg)
        if email:
            log_and_send(
                NotificationChannel.EMAIL,
                send_email,
                email,
                "Booking Confirmed",
                template,
                **data,
            )

        if user_id and create_ticket_in_app:
            create_in_app_notification(
                db,
                user_id,
                "CUSTOMER",
                NotificationType.BOOKING_CONFIRMED,
                f"Booking confirmed! Ref: {data.get('booking_id')}. {route_text} on {time_text}. Seat(s): {seats_text}.",
                metadata={**data, "booking": booking_record or {}, "trip_bookings": trip_bookings},
            )

        if operator_id:
            create_in_app_notification(
                db,
                operator_id,
                "OPERATOR",
                NotificationType.NEW_BOOKING_ALERT,
                f"New booking confirmed on {route_text} for {time_text}. Booking ref: {data.get('booking_id')}. Seats: {seats_text or 'n/a' }.",
                metadata={**data, "booking": booking_record or {}},
            )

    elif template == "booking_cancelled" and topic == "notification.send":
        if phone:
            amount = data.get("amount", 0)
            if amount > 0:
                msg = f"BusGo: Booking {data.get('booking_id')} cancelled. Refund of {amount} BDT initiated."
            else:
                msg = f"BusGo: Booking {data.get('booking_id')} cancelled."
            log_and_send(NotificationChannel.SMS, send_sms, phone, msg)

        if user_id:
            create_in_app_notification(
                db,
                user_id,
                "CUSTOMER",
                NotificationType.BOOKING_CANCELLED,
                f"Booking {data.get('booking_id')} has been cancelled." + (
                    f" Refund of {data.get('amount')} BDT initiated." if data.get("amount") else ""
                ),
                metadata={**data, "booking": booking_record or {}, "trip_bookings": trip_bookings},
            )

        if operator_id:
            create_in_app_notification(
                db,
                operator_id,
                "OPERATOR",
                NotificationType.BOOKING_CANCELLED,
                f"A booking was cancelled for { _booking_route_text(booking_record, data) }. Booking ref: {data.get('booking_id')}.",
                metadata={**data, "booking": booking_record or {}},
            )

    elif template == "departure_reminder":
        if phone:
            msg = f"BusGo Reminder: Your bus departs in 2 hours. Boarding at {data.get('boarding_point')}"
            log_and_send(NotificationChannel.SMS, send_sms, phone, msg)
        if fcm_token:
            log_and_send(
                NotificationChannel.PUSH,
                send_push,
                fcm_token,
                "Departure Reminder",
                "Your bus departs in 2 hours! \ud83d\ude8c",
            )

        if user_id:
            create_in_app_notification(
                db,
                user_id,
                "CUSTOMER",
                NotificationType.DEPARTURE_REMINDER,
                f"Your bus departs in about 2 hours from {data.get('boarding_point', 'your boarding point')}.",
                metadata={**data, "booking": booking_record or {}, "trip_bookings": trip_bookings},
            )

    elif template == "ticket_issued" and topic == "notification.send":
        if email:
            log_and_send(
                NotificationChannel.EMAIL,
                send_email,
                email,
                "Your E-Ticket",
                template,
                **data,
            )
        if phone:
            msg = f"Your e-ticket is ready: {data.get('pdf_url')}"
            log_and_send(NotificationChannel.WHATSAPP, send_whatsapp, phone, msg)

        if user_id and create_ticket_in_app:
            create_in_app_notification(
                db,
                user_id,
                "CUSTOMER",
                NotificationType.TICKET_ISSUED,
                f"Your e-ticket for booking {data.get('booking_id') or event.get('booking_id')} is ready. Tap to download.",
                metadata={**data, "booking": booking_record or {}, "trip_bookings": trip_bookings},
            )

        if operator_id and booking_record:
            create_in_app_notification(
                db,
                operator_id,
                "OPERATOR",
                NotificationType.NEW_BOOKING_ALERT,
                f"Ticket issued for { _booking_route_text(booking_record, data) }. Booking ref: {booking_record.get('id') }.",
                metadata={**data, "booking": booking_record or {}},
            )

    # -----------------------------------------------------------------------
    # SCHEDULE CHANGED — notify affected customer
    # -----------------------------------------------------------------------
    elif template == "schedule_changed":
        origin   = data.get("origin", "")
        dest     = data.get("destination", "")
        old_time = data.get("old_departure_time", "")
        new_time = data.get("new_departure_time", "")
        msg = (
            f"Your trip from {origin} to {dest} has been rescheduled. "
            f"Old time: {old_time} → New time: {new_time}. "
            f"Booking ref: {data.get('booking_id', 'N/A')}."
        )
        if phone:
            log_and_send(NotificationChannel.SMS, send_sms, phone, f"BusGo: {msg}")
        create_in_app_notification(
            db, user_id, "CUSTOMER",
            NotificationType.SCHEDULE_CHANGED,
            msg, metadata=data,
        )

        if operator_id:
            create_in_app_notification(
                db,
                operator_id,
                "OPERATOR",
                NotificationType.ROUTE_UPDATE_CONFIRMED,
                f"Schedule update confirmed for {origin} to {dest}. Old time: {old_time or 'n/a'} | New time: {new_time or 'n/a'}.",
                metadata={**data, "booking": booking_record or {}, "trip_bookings": trip_bookings},
            )

        for recipient_id in admin_recipients:
            create_in_app_notification(
                db,
                recipient_id,
                "ADMIN",
                NotificationType.SYSTEM_ALERT,
                f"Schedule updated for {origin} → {dest}. Old time: {old_time or 'n/a'} | New time: {new_time or 'n/a' }.",
                metadata={**data, "booking": booking_record or {}, "trip_bookings": trip_bookings},
            )

    # -----------------------------------------------------------------------
    # BUS DELAYED — notify affected customer
    # -----------------------------------------------------------------------
    elif template == "bus_delayed":
        delay_minutes = data.get("delay_minutes", 0)
        msg = (
            f"Your bus from {data.get('origin', '')} to {data.get('destination', '')} "
            f"is delayed by approximately {delay_minutes} minute(s). "
            f"We apologise for the inconvenience."
        )
        if phone:
            log_and_send(NotificationChannel.SMS, send_sms, phone, f"BusGo: {msg}")
        create_in_app_notification(
            db, user_id, "CUSTOMER",
            NotificationType.BUS_DELAYED,
            msg, metadata=data,
        )

        if operator_id:
            create_in_app_notification(
                db,
                operator_id,
                "OPERATOR",
                NotificationType.ROUTE_UPDATE_CONFIRMED,
                f"Delay alert for {data.get('origin', '')} → {data.get('destination', '')}: approximately {delay_minutes} minute(s).",
                metadata={**data, "booking": booking_record or {}, "trip_bookings": trip_bookings},
            )

        for recipient_id in admin_recipients:
            create_in_app_notification(
                db,
                recipient_id,
                "ADMIN",
                NotificationType.SYSTEM_ALERT,
                f"Delay alert issued for {data.get('origin', '')} → {data.get('destination', '')}: approximately {delay_minutes} minute(s).",
                metadata={**data, "booking": booking_record or {}, "trip_bookings": trip_bookings},
            )

    # -----------------------------------------------------------------------
    # REFUND INITIATED
    # -----------------------------------------------------------------------
    elif template == "refund_initiated":
        amount = data.get("amount", 0)
        msg = f"Refund of {amount} BDT for booking {data.get('booking_id')} has been initiated. It will arrive in 3-5 business days."
        if phone:
            log_and_send(NotificationChannel.SMS, send_sms, phone, f"BusGo: {msg}")
        create_in_app_notification(
            db, user_id, "CUSTOMER",
            NotificationType.REFUND_INITIATED,
            msg, metadata=data,
        )

    # -----------------------------------------------------------------------
    # REFUND COMPLETED
    # -----------------------------------------------------------------------
    elif template == "refund_completed":
        amount = data.get("amount", 0)
        msg = f"Refund of {amount} BDT for booking {data.get('booking_id')} has been successfully credited to your account."
        if phone:
            log_and_send(NotificationChannel.SMS, send_sms, phone, f"BusGo: {msg}")
        create_in_app_notification(
            db, user_id, "CUSTOMER",
            NotificationType.REFUND_COMPLETED,
            msg, metadata=data,
        )

    elif template == "booking_expired":
        if user_id:
            create_in_app_notification(
                db,
                user_id,
                "CUSTOMER",
                NotificationType.BOOKING_CANCELLED,
                f"Your seat lock expired for booking {data.get('booking_id')}. Please rebook if you still want the trip.",
                metadata={**data, "booking": booking_record or {}, "trip_bookings": trip_bookings},
            )

        if operator_id:
            create_in_app_notification(
                db,
                operator_id,
                "OPERATOR",
                NotificationType.BOOKING_ANOMALY,
                f"A seat lock expired for booking {data.get('booking_id')}.",
                metadata={**data, "booking": booking_record or {}},
            )

    # -----------------------------------------------------------------------
    # Also persist existing templates to in-app (additive — existing logic
    # above already ran SMS/Email; we just add in-app on top)
    # -----------------------------------------------------------------------
    if template == "booking_confirmed":
        msg = (
            f"Booking confirmed! Ref: {data.get('booking_id')}. "
            f"{data.get('origin')} → {data.get('dest')} on {data.get('date')}. "
            f"Seat(s): {data.get('seats')}."
        )
        create_in_app_notification(
            db, user_id, "CUSTOMER",
            NotificationType.BOOKING_CONFIRMED,
            msg, metadata=data,
        )
    elif template == "booking_cancelled":
        amount = data.get("amount", 0)
        msg = f"Booking {data.get('booking_id')} has been cancelled."
        if amount > 0:
            msg += f" Refund of {amount} BDT initiated."
        create_in_app_notification(
            db, user_id, "CUSTOMER",
            NotificationType.BOOKING_CANCELLED,
            msg, metadata=data,
        )
    elif template == "ticket_issued":
        msg = f"Your e-ticket for booking {data.get('booking_id')} is ready. Tap to download."
        create_in_app_notification(
            db, user_id, "CUSTOMER",
            NotificationType.TICKET_ISSUED,
            msg, metadata=data,
        )
    elif template == "departure_reminder" and topic == "notification.send":
        msg = f"Your bus departs in ~2 hours from {data.get('boarding_point', 'your boarding point')}. Have a safe journey!"
        create_in_app_notification(
            db, user_id, "CUSTOMER",
            NotificationType.DEPARTURE_REMINDER,
            msg, metadata=data,
        )

    # -----------------------------------------------------------------------
    # OPERATOR — new booking alert
    # -----------------------------------------------------------------------
    elif template == "operator_new_booking":
        operator_id = data.get("operator_id") or user_id
        booking_id  = data.get("booking_id", "")
        route       = f"{data.get('origin', '')} → {data.get('destination', '')}"
        seats       = data.get("seats_booked", 1)
        fare        = data.get("total_fare", 0)
        trip_date   = data.get("trip_date", "")
        msg = (
            f"{seats} seat(s) booked on your bus for {route} on {trip_date}. "
            f"Fare collected: {fare} BDT. Booking ref: {booking_id}."
        )
        create_in_app_notification(
            db, operator_id, "OPERATOR",
            NotificationType.NEW_BOOKING_ALERT,
            msg, metadata=data,
        )

    # -----------------------------------------------------------------------
    # OPERATOR — daily booking summary
    # -----------------------------------------------------------------------
    elif template == "operator_daily_summary":
        operator_id   = data.get("operator_id") or user_id
        total_bookings = data.get("total_bookings", 0)
        total_revenue  = data.get("total_revenue", 0)
        date_str       = data.get("date", "today")
        msg = (
            f"Daily Summary ({date_str}): {total_bookings} booking(s) across all your routes. "
            f"Total revenue: {total_revenue} BDT."
        )
        create_in_app_notification(
            db, operator_id, "OPERATOR",
            NotificationType.DAILY_BOOKING_SUMMARY,
            msg, metadata=data,
        )

    # -----------------------------------------------------------------------
    # OPERATOR — revenue summary (weekly)
    # -----------------------------------------------------------------------
    elif template == "operator_revenue_summary":
        operator_id   = data.get("operator_id") or user_id
        week_revenue  = data.get("week_revenue", 0)
        week_bookings = data.get("week_bookings", 0)
        period        = data.get("period", "this week")
        msg = (
            f"Revenue Summary ({period}): {week_bookings} bookings, "
            f"total revenue {week_revenue} BDT."
        )
        create_in_app_notification(
            db, operator_id, "OPERATOR",
            NotificationType.REVENUE_SUMMARY,
            msg, metadata=data,
        )

    # -----------------------------------------------------------------------
    # OPERATOR — route update confirmed
    # -----------------------------------------------------------------------
    elif template == "operator_route_update":
        operator_id = data.get("operator_id") or user_id
        route_name  = data.get("route_name", "your route")
        msg = f"Your update to '{route_name}' has been reviewed and confirmed."
        create_in_app_notification(
            db, operator_id, "OPERATOR",
            NotificationType.ROUTE_UPDATE_CONFIRMED,
            msg, metadata=data,
        )

    # -----------------------------------------------------------------------
    # ADMIN — new operator registered
    # -----------------------------------------------------------------------
    elif template == "admin_new_operator":
        admin_targets = [str(data.get("admin_id"))] if data.get("admin_id") else admin_recipients
        operator_name = data.get("operator_name", "A new operator")
        email         = data.get("operator_email", "")
        msg = f"{operator_name} ({email}) has registered as an operator and is pending review."
        for recipient_id in admin_targets:
            create_in_app_notification(
                db, recipient_id, "ADMIN",
                NotificationType.NEW_OPERATOR_REGISTERED,
                msg, metadata=data,
            )

    # -----------------------------------------------------------------------
    # ADMIN — new user registered
    # -----------------------------------------------------------------------
    elif template == "admin_new_user":
        admin_targets = [str(data.get("admin_id"))] if data.get("admin_id") else admin_recipients
        user_name  = data.get("user_name", "A new user")
        user_email = data.get("user_email", "")
        msg = f"{user_name} ({user_email}) has created an account."
        for recipient_id in admin_targets:
            create_in_app_notification(
                db, recipient_id, "ADMIN",
                NotificationType.NEW_USER_REGISTERED,
                msg, metadata=data,
            )

    # -----------------------------------------------------------------------
    # ADMIN — system alert
    # -----------------------------------------------------------------------
    elif template == "admin_system_alert":
        admin_targets = [str(data.get("admin_id"))] if data.get("admin_id") else admin_recipients
        service  = data.get("service", "unknown service")
        detail   = data.get("detail", "An anomaly was detected.")
        msg = f"[System Alert] {service}: {detail}"
        for recipient_id in admin_targets:
            create_in_app_notification(
                db, recipient_id, "ADMIN",
                NotificationType.SYSTEM_ALERT,
                msg, metadata=data,
            )

    # -----------------------------------------------------------------------
    # ADMIN — daily platform summary
    # -----------------------------------------------------------------------
    elif template == "admin_daily_summary":
        admin_targets = [str(data.get("admin_id"))] if data.get("admin_id") else admin_recipients
        total_bookings = data.get("total_bookings", 0)
        total_revenue  = data.get("total_revenue", 0)
        active_users   = data.get("active_users", 0)
        date_str       = data.get("date", "today")
        msg = (
            f"Platform Daily Summary ({date_str}): {total_bookings} bookings, "
            f"{active_users} active users, revenue: {total_revenue} BDT."
        )
        for recipient_id in admin_targets:
            create_in_app_notification(
                db, recipient_id, "ADMIN",
                NotificationType.DAILY_PLATFORM_SUMMARY,
                msg, metadata=data,
            )

    # -----------------------------------------------------------------------
    # ADMIN — user complaint
    # -----------------------------------------------------------------------
    elif template == "admin_user_complaint":
        admin_targets = [str(data.get("admin_id"))] if data.get("admin_id") else admin_recipients
        complainant  = data.get("user_name", "A user")
        complaint    = data.get("complaint_summary", "a complaint")
        msg = f"{complainant} has filed a complaint: \"{complaint}\""
        for recipient_id in admin_targets:
            create_in_app_notification(
                db, recipient_id, "ADMIN",
                NotificationType.USER_COMPLAINT,
                msg, metadata=data,
            )

    # -----------------------------------------------------------------------
    # ADMIN — weekly revenue report
    # -----------------------------------------------------------------------
    elif template == "admin_revenue_report":
        admin_targets = [str(data.get("admin_id"))] if data.get("admin_id") else admin_recipients
        week_revenue  = data.get("week_revenue", 0)
        week_bookings = data.get("week_bookings", 0)
        period        = data.get("period", "this week")
        msg = (
            f"Weekly Revenue Report ({period}): {week_bookings} total bookings, "
            f"platform revenue: {week_revenue} BDT."
        )
        for recipient_id in admin_targets:
            create_in_app_notification(
                db, recipient_id, "ADMIN",
                NotificationType.WEEKLY_REVENUE_REPORT,
                msg, metadata=data,
            )

    db.close()


# ---------------------------------------------------------------------------
# Kafka topics consumed by this service
# ---------------------------------------------------------------------------

NOTIFICATION_TOPICS = [
    "notification.send",        # legacy generic topic
    "booking.confirmed",        # emitted by booking-service after payment
    "booking.cancelled",        # emitted by booking/cancellation-service
    "trip.schedule_changed",    # emitted by operator-service
    "trip.delayed",             # emitted by operator-service
    "operator.booking_alert",   # emitted by booking-service for operators
    "operator.daily_summary",   # emitted by scheduler
    "operator.revenue_summary", # emitted by scheduler
    "operator.route_update",    # emitted by operator-service
    "admin.new_operator",       # emitted by auth-service
    "admin.new_user",           # emitted by auth-service
    "admin.system_alert",       # emitted by any service on critical error
    "admin.daily_summary",      # emitted by scheduler
    "admin.complaint",          # emitted by customer support flow
    "admin.revenue_report",     # emitted by scheduler
]


def start_consumer():
    try:
        consumer = KafkaConsumer(
            *NOTIFICATION_TOPICS,
            bootstrap_servers=[os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")],
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            group_id="notification-group",
        )
        logger.info("Kafka consumer for notification.send started.")
        for message in consumer:
            event = message.value
            logger.info(f"Received notification event: {event}")
            process_notification(event)
    except Exception as e:
        logger.error(f"Error starting Kafka consumer: {e}")


def run_consumer_bg():
    thread = threading.Thread(target=start_consumer, daemon=True)
    thread.start()


if __name__ == "__main__":
    start_consumer()
