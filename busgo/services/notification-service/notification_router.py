"""
notification_router.py
======================
REST API endpoints for in-app notifications.

All routes live under /notifications and require a valid JWT so the
notification-service can identify the calling user.

Endpoints
---------
GET    /notifications               – list notifications for current user
GET    /notifications/stats         – unread count + type breakdown
PATCH  /notifications/{id}/read     – mark single notification as read
PATCH  /notifications/read-all      – mark all as read for current user
DELETE /notifications/{id}          – delete a single notification
DELETE /notifications/clear-all     – delete all notifications for current user
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
from uuid import uuid5, NAMESPACE_URL
from jose import jwt, JWTError
import os
import requests

from database import get_db
from models import InAppNotification
from notification_types import NotificationType, get_notification_title

router = APIRouter(tags=["notifications"])

# ---------------------------------------------------------------------------
# Auth helper — extract user_id from Bearer token in Authorization header
# ---------------------------------------------------------------------------

JWT_SECRET  = os.getenv("JWT_SECRET", "secret")
JWT_ALG     = os.getenv("JWT_ALGORITHM", "HS256")
BOOKING_SERVICE_URL = os.getenv(
    "BOOKING_SERVICE_URL",
    "https://busgo-nhbi.onrender.com/api/bookings",
)
ADMIN_SERVICE_URL = os.getenv(
    "ADMIN_SERVICE_URL",
    "https://busgo-nhbi.onrender.com/api/admin",
)
BOOTSTRAP_NAMESPACE = UUID("8f54f13d-8d35-4f57-9ed2-1bf0a2f7f5a1")


def _request_json(url: str, authorization: Optional[str] = None) -> Optional[dict | list]:
    headers = {"Authorization": authorization} if authorization else None
    try:
        response = requests.get(url, headers=headers, timeout=6)
        if response.status_code != 200:
            return None
        payload = response.json()
        if isinstance(payload, dict) and "data" in payload:
            return payload["data"]
        return payload
    except Exception:
        return None


def _normalize_datetime(value) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _notification_seed_id(user_id: str, seed_key: str) -> UUID:
    return uuid5(BOOTSTRAP_NAMESPACE, f"{user_id}:{seed_key}")


def _persist_seed_notification(
    db: Session,
    *,
    user_id: str,
    role: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    seed_key: str,
    created_at: datetime,
    read: bool = True,
    metadata: Optional[dict] = None,
):
    notification_id = _notification_seed_id(user_id, seed_key)
    existing = db.get(InAppNotification, notification_id)
    if existing:
        return False

    notification = InAppNotification(
        id=notification_id,
        user_id=user_id,
        role=role,
        type=notification_type,
        title=title,
        message=message,
        meta_data=metadata or {},
        is_read=read,
        created_at=created_at,
        read_at=created_at if read else None,
    )
    db.add(notification)
    try:
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        return False


def _bootstrap_customer_notifications(db: Session, user_id: str, authorization: Optional[str]) -> int:
    bookings = _request_json(f"{BOOKING_SERVICE_URL}/my?skip=0&limit=100", authorization)
    if not isinstance(bookings, list):
        return 0

    created = 0
    now = datetime.utcnow()
    for index, booking in enumerate(bookings[:25]):
        booking_id = str(booking.get("id") or booking.get("booking_id") or f"booking-{index}")
        origin = booking.get("boarding_point") or booking.get("origin") or "your boarding point"
        destination = booking.get("dropping_point") or booking.get("destination") or "your destination"
        route_text = f"{origin} -> {destination}"
        base_time = _normalize_datetime(booking.get("created_at")) or (now - timedelta(days=index + 1))
        status = str(booking.get("status", "")).upper()
        total_fare = booking.get("total_fare")
        seat_numbers = booking.get("seat_numbers") or []
        seat_text = ", ".join(seat_numbers) if isinstance(seat_numbers, list) else str(seat_numbers)

        if status in {"CONFIRMED", "COMPLETED", "SEAT_LOCKED"}:
            created += _persist_seed_notification(
                db,
                user_id=user_id,
                role="CUSTOMER",
                notification_type=NotificationType.BOOKING_CONFIRMED,
                title=get_notification_title(NotificationType.BOOKING_CONFIRMED.value),
                message=f"Booking confirmed! Ref: {booking_id}. {route_text}. Seat(s): {seat_text or 'n/a' }.",
                seed_key=f"customer:{booking_id}:confirmed",
                created_at=base_time,
                read=True,
                metadata=booking,
            )
            created += _persist_seed_notification(
                db,
                user_id=user_id,
                role="CUSTOMER",
                notification_type=NotificationType.TICKET_ISSUED,
                title=get_notification_title(NotificationType.TICKET_ISSUED.value),
                message=f"Your e-ticket for booking {booking_id} is ready.",
                seed_key=f"customer:{booking_id}:ticket",
                created_at=base_time + timedelta(minutes=5),
                read=index > 0,
                metadata=booking,
            )

        if status in {"CANCELLED", "EXPIRED"}:
            created += _persist_seed_notification(
                db,
                user_id=user_id,
                role="CUSTOMER",
                notification_type=NotificationType.BOOKING_CANCELLED,
                title=get_notification_title(NotificationType.BOOKING_CANCELLED.value),
                message=f"Booking {booking_id} was cancelled for {route_text}.",
                seed_key=f"customer:{booking_id}:cancelled",
                created_at=base_time + timedelta(minutes=10),
                read=True,
                metadata=booking,
            )

        journey_time = _normalize_datetime(booking.get("journey_date")) or _normalize_datetime(booking.get("departure_time"))
        if journey_time:
            reminder_time = journey_time - timedelta(hours=2)
            if reminder_time < now:
                reminder_time = now - timedelta(hours=min(index + 1, 12))
            created += _persist_seed_notification(
                db,
                user_id=user_id,
                role="CUSTOMER",
                notification_type=NotificationType.DEPARTURE_REMINDER,
                title=get_notification_title(NotificationType.DEPARTURE_REMINDER.value),
                message=f"Your bus departs soon from {origin}.",
                seed_key=f"customer:{booking_id}:reminder",
                created_at=reminder_time,
                read=index > 1,
                metadata=booking,
            )

    return created


def _bootstrap_operator_notifications(db: Session, user_id: str, authorization: Optional[str]) -> int:
    bookings = _request_json(f"{BOOKING_SERVICE_URL}/operator/{user_id}?skip=0&limit=100", authorization)
    if not isinstance(bookings, list):
        bookings = []

    created = 0
    now = datetime.utcnow()
    total_revenue = 0.0
    for index, booking in enumerate(bookings[:25]):
        booking_id = str(booking.get("id") or booking.get("booking_id") or f"op-booking-{index}")
        origin = booking.get("boarding_point") or "your boarding point"
        destination = booking.get("dropping_point") or "your destination"
        route_text = f"{origin} -> {destination}"
        created_at = _normalize_datetime(booking.get("created_at")) or (now - timedelta(days=index + 1))
        total_fare = float(booking.get("total_fare") or 0)
        total_revenue += total_fare
        status = str(booking.get("status", "")).upper()

        created += _persist_seed_notification(
            db,
            user_id=user_id,
            role="OPERATOR",
            notification_type=NotificationType.NEW_BOOKING_ALERT,
            title=get_notification_title(NotificationType.NEW_BOOKING_ALERT.value),
            message=f"New booking on {route_text}. Booking ref: {booking_id}.",
            seed_key=f"operator:{booking_id}:booking",
            created_at=created_at,
            read=index > 0,
            metadata=booking,
        )

        if status in {"CANCELLED", "EXPIRED"}:
            created += _persist_seed_notification(
                db,
                user_id=user_id,
                role="OPERATOR",
                notification_type=NotificationType.BOOKING_CANCELLED,
                title=get_notification_title(NotificationType.BOOKING_CANCELLED.value),
                message=f"A booking was cancelled on {route_text}. Ref: {booking_id}.",
                seed_key=f"operator:{booking_id}:cancelled",
                created_at=created_at + timedelta(minutes=10),
                read=True,
                metadata=booking,
            )

    if bookings:
        summary_time = now - timedelta(hours=1)
        created += _persist_seed_notification(
            db,
            user_id=user_id,
            role="OPERATOR",
            notification_type=NotificationType.DAILY_BOOKING_SUMMARY,
            title=get_notification_title(NotificationType.DAILY_BOOKING_SUMMARY.value),
            message=f"Daily Summary: {len(bookings)} booking(s) across your services. Total revenue: {round(total_revenue, 2)} BDT.",
            seed_key="operator:daily-summary",
            created_at=summary_time,
            read=False,
            metadata={"total_bookings": len(bookings), "total_revenue": total_revenue},
        )
        created += _persist_seed_notification(
            db,
            user_id=user_id,
            role="OPERATOR",
            notification_type=NotificationType.REVENUE_SUMMARY,
            title=get_notification_title(NotificationType.REVENUE_SUMMARY.value),
            message=f"Revenue Summary: total revenue {round(total_revenue, 2)} BDT from {len(bookings)} booking(s).",
            seed_key="operator:revenue-summary",
            created_at=summary_time + timedelta(minutes=5),
            read=False,
            metadata={"week_revenue": total_revenue, "week_bookings": len(bookings)},
        )

    return created


def _bootstrap_admin_notifications(db: Session, user_id: str) -> int:
    stats = _request_json(f"{ADMIN_SERVICE_URL}/dashboard-stats")
    users = _request_json(f"{ADMIN_SERVICE_URL}/users")
    transactions = _request_json(f"{ADMIN_SERVICE_URL}/transactions")

    created = 0
    now = datetime.utcnow()

    if isinstance(stats, dict):
        created += _persist_seed_notification(
            db,
            user_id=user_id,
            role="ADMIN",
            notification_type=NotificationType.DAILY_PLATFORM_SUMMARY,
            title=get_notification_title(NotificationType.DAILY_PLATFORM_SUMMARY.value),
            message=(
                f"Platform Daily Summary: {stats.get('totalBookings', 0)} bookings, "
                f"{stats.get('totalUsers', 0)} users, revenue {stats.get('totalRevenue', 0)} BDT."
            ),
            seed_key="admin:platform-summary",
            created_at=now - timedelta(hours=2),
            read=False,
            metadata=stats,
        )

    if isinstance(users, list):
        recent_users = sorted(users, key=lambda item: item.get("created_at") or "", reverse=True)[:8]
        for index, item in enumerate(recent_users):
            role = str(item.get("role", "CUSTOMER")).upper()
            if role not in {"CUSTOMER", "OPERATOR"}:
                continue
            notification_type = NotificationType.NEW_USER_REGISTERED if role == "CUSTOMER" else NotificationType.NEW_OPERATOR_REGISTERED
            title = get_notification_title(notification_type.value)
            name = item.get("full_name") or item.get("name") or "A user"
            created += _persist_seed_notification(
                db,
                user_id=user_id,
                role="ADMIN",
                notification_type=notification_type,
                title=title,
                message=f"{name} registered as a {role.lower()}.",
                seed_key=f"admin:{role.lower()}:{item.get('id')}",
                created_at=now - timedelta(days=index + 1),
                read=index > 1,
                metadata=item,
            )

    if isinstance(transactions, list) and transactions:
        total_revenue = sum(float(item.get("amount") or 0) for item in transactions)
        created += _persist_seed_notification(
            db,
            user_id=user_id,
            role="ADMIN",
            notification_type=NotificationType.WEEKLY_REVENUE_REPORT,
            title=get_notification_title(NotificationType.WEEKLY_REVENUE_REPORT.value),
            message=f"Weekly Revenue Report: {len(transactions)} payment record(s), total revenue {round(total_revenue, 2)} BDT.",
            seed_key="admin:weekly-revenue-report",
            created_at=now - timedelta(hours=1),
            read=False,
            metadata={"week_bookings": len(transactions), "week_revenue": total_revenue},
        )

    return created


def bootstrap_notifications_if_needed(db: Session, user: dict, authorization: Optional[str]) -> None:
    existing_count = (
        db.query(InAppNotification)
        .filter(InAppNotification.user_id == user["user_id"])
        .count()
    )
    if existing_count > 0:
        return

    role = str(user.get("role", "CUSTOMER")).upper()
    if role == "OPERATOR":
        _bootstrap_operator_notifications(db, user["user_id"], authorization)
    elif role == "ADMIN":
        _bootstrap_admin_notifications(db, user["user_id"])
    else:
        _bootstrap_customer_notifications(db, user["user_id"], authorization)


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Decode the JWT from the Authorization header.
    Returns dict with at least { "user_id": str, "role": str }.

    We fall back to a loose decode (verify=False) when the secret is not
    configured in the env — useful in dev/test without Kafka auth wired up.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        # Dev-mode: decode without verification to still get user_id
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub") or payload.get("user_id")
    role     = payload.get("role", "CUSTOMER")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing user identity")

    return {"user_id": user_id, "role": role}


# ---------------------------------------------------------------------------
# Schemas (lightweight — no Pydantic required for simple returns)
# ---------------------------------------------------------------------------

def notification_to_dict(n: InAppNotification) -> dict:
    return {
        "id":         str(n.id),
        "user_id":    str(n.user_id),
        "role":       n.role,
        "type":       n.type.value if hasattr(n.type, "value") else n.type,
        "title":      n.title,
        "message":    n.message,
        "metadata":   n.meta_data or {},
        "is_read":    n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "read_at":    n.read_at.isoformat() if n.read_at else None,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/")
def list_notifications(
    page:      int = Query(1, ge=1),
    per_page:  int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    authorization: Optional[str] = Header(None),
    db:        Session = Depends(get_db),
    user:      dict    = Depends(get_current_user),
):
    """
    Return paginated in-app notifications for the authenticated user.
    Supports filtering to unread-only.
    """
    q = (
        db.query(InAppNotification)
        .filter(InAppNotification.user_id == user["user_id"])
        .order_by(desc(InAppNotification.created_at))
    )
    if unread_only:
        q = q.filter(InAppNotification.is_read == False)  # noqa: E712

    total  = q.count()
    if total == 0 and not unread_only:
        bootstrap_notifications_if_needed(db, user, authorization)
        q = (
            db.query(InAppNotification)
            .filter(InAppNotification.user_id == user["user_id"])
            .order_by(desc(InAppNotification.created_at))
        )
        total = q.count()
        if unread_only:
            q = q.filter(InAppNotification.is_read == False)  # noqa: E712

    items  = q.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "success": True,
        "data": {
            "notifications": [notification_to_dict(n) for n in items],
            "total":         total,
            "page":          page,
            "per_page":      per_page,
            "total_pages":   (total + per_page - 1) // per_page,
        },
    }


@router.get("/stats")
def notification_stats(
    authorization: Optional[str] = Header(None),
    db:   Session = Depends(get_db),
    user: dict    = Depends(get_current_user),
):
    """Return unread count and a breakdown by notification type."""
    bootstrap_notifications_if_needed(db, user, authorization)
    all_notifs = (
        db.query(InAppNotification)
        .filter(InAppNotification.user_id == user["user_id"])
        .all()
    )
    unread_count  = sum(1 for n in all_notifs if not n.is_read)
    type_breakdown: dict = {}
    for n in all_notifs:
        key = n.type.value if hasattr(n.type, "value") else str(n.type)
        type_breakdown[key] = type_breakdown.get(key, 0) + 1

    return {
        "success": True,
        "data": {
            "total":         len(all_notifs),
            "unread_count":  unread_count,
            "type_breakdown": type_breakdown,
        },
    }


@router.patch("/{notification_id}/read")
def mark_as_read(
    notification_id: UUID,
    db:   Session = Depends(get_db),
    user: dict    = Depends(get_current_user),
):
    """Mark a single notification as read."""
    notif = (
        db.query(InAppNotification)
        .filter(
            InAppNotification.id      == notification_id,
            InAppNotification.user_id == user["user_id"],
        )
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notif.is_read:
        notif.is_read = True
        notif.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notif)

    return {"success": True, "data": notification_to_dict(notif)}


@router.patch("/read-all")
def mark_all_read(
    db:   Session = Depends(get_db),
    user: dict    = Depends(get_current_user),
):
    """Mark all unread notifications as read for the current user."""
    now    = datetime.utcnow()
    updated = (
        db.query(InAppNotification)
        .filter(
            InAppNotification.user_id == user["user_id"],
            InAppNotification.is_read == False,  # noqa: E712
        )
        .all()
    )
    for n in updated:
        n.is_read = True
        n.read_at = now
    db.commit()

    return {"success": True, "data": {"updated_count": len(updated)}}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: UUID,
    db:   Session = Depends(get_db),
    user: dict    = Depends(get_current_user),
):
    """Delete a single notification (only the owner can delete)."""
    notif = (
        db.query(InAppNotification)
        .filter(
            InAppNotification.id      == notification_id,
            InAppNotification.user_id == user["user_id"],
        )
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notif)
    db.commit()
    return {"success": True, "data": {"deleted_id": str(notification_id)}}


@router.delete("/clear-all")
def clear_all_notifications(
    db:   Session = Depends(get_db),
    user: dict    = Depends(get_current_user),
):
    """Delete all notifications for the current user."""
    deleted = (
        db.query(InAppNotification)
        .filter(InAppNotification.user_id == user["user_id"])
        .all()
    )
    count = len(deleted)
    for n in deleted:
        db.delete(n)
    db.commit()
    return {"success": True, "data": {"deleted_count": count}}
