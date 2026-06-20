"""
notification_types.py
=====================
All notification type enums and metadata for BusGo.
Scoped by user role: CUSTOMER, OPERATOR, ADMIN.

This file is self-contained — import from here instead of defining
types inline so every service speaks the same language.
"""

import enum


# ---------------------------------------------------------------------------
# Notification type enums
# ---------------------------------------------------------------------------

class CustomerNotificationType(str, enum.Enum):
    BOOKING_CONFIRMED   = "BOOKING_CONFIRMED"
    BOOKING_CANCELLED   = "BOOKING_CANCELLED"
    TICKET_ISSUED       = "TICKET_ISSUED"
    DEPARTURE_REMINDER  = "DEPARTURE_REMINDER"
    SCHEDULE_CHANGED    = "SCHEDULE_CHANGED"
    BUS_DELAYED         = "BUS_DELAYED"
    REFUND_INITIATED    = "REFUND_INITIATED"
    REFUND_COMPLETED    = "REFUND_COMPLETED"


class OperatorNotificationType(str, enum.Enum):
    NEW_BOOKING_ALERT      = "NEW_BOOKING_ALERT"
    BOOKING_CANCELLED      = "BOOKING_CANCELLED"
    DAILY_BOOKING_SUMMARY  = "DAILY_BOOKING_SUMMARY"
    REVENUE_SUMMARY        = "REVENUE_SUMMARY"
    ROUTE_UPDATE_CONFIRMED = "ROUTE_UPDATE_CONFIRMED"
    OPERATOR_TO_USER       = "OPERATOR_TO_USER"


class AdminNotificationType(str, enum.Enum):
    NEW_OPERATOR_REGISTERED  = "NEW_OPERATOR_REGISTERED"
    NEW_USER_REGISTERED      = "NEW_USER_REGISTERED"
    SYSTEM_ALERT             = "SYSTEM_ALERT"
    DAILY_PLATFORM_SUMMARY   = "DAILY_PLATFORM_SUMMARY"
    WEEKLY_REVENUE_REPORT    = "WEEKLY_REVENUE_REPORT"
    USER_COMPLAINT           = "USER_COMPLAINT"
    BOOKING_ANOMALY          = "BOOKING_ANOMALY"
    ADMIN_BROADCAST          = "ADMIN_BROADCAST"


# Combined enum for the DB column (all values in one flat enum)
class NotificationType(str, enum.Enum):
    # Customer
    BOOKING_CONFIRMED       = "BOOKING_CONFIRMED"
    BOOKING_CANCELLED       = "BOOKING_CANCELLED"
    TICKET_ISSUED           = "TICKET_ISSUED"
    DEPARTURE_REMINDER      = "DEPARTURE_REMINDER"
    SCHEDULE_CHANGED        = "SCHEDULE_CHANGED"
    BUS_DELAYED             = "BUS_DELAYED"
    REFUND_INITIATED        = "REFUND_INITIATED"
    REFUND_COMPLETED        = "REFUND_COMPLETED"

    # Operator
    NEW_BOOKING_ALERT       = "NEW_BOOKING_ALERT"
    DAILY_BOOKING_SUMMARY   = "DAILY_BOOKING_SUMMARY"
    REVENUE_SUMMARY         = "REVENUE_SUMMARY"
    ROUTE_UPDATE_CONFIRMED  = "ROUTE_UPDATE_CONFIRMED"
    OPERATOR_TO_USER        = "OPERATOR_TO_USER"   # operator-initiated message to passengers

    # Admin
    NEW_OPERATOR_REGISTERED = "NEW_OPERATOR_REGISTERED"
    NEW_USER_REGISTERED     = "NEW_USER_REGISTERED"
    SYSTEM_ALERT            = "SYSTEM_ALERT"
    DAILY_PLATFORM_SUMMARY  = "DAILY_PLATFORM_SUMMARY"
    WEEKLY_REVENUE_REPORT   = "WEEKLY_REVENUE_REPORT"
    USER_COMPLAINT          = "USER_COMPLAINT"
    BOOKING_ANOMALY         = "BOOKING_ANOMALY"
    ADMIN_BROADCAST         = "ADMIN_BROADCAST"    # admin-initiated broadcast to users/operators


# ---------------------------------------------------------------------------
# Metadata helpers: title templates and icon hints used by the frontend
# ---------------------------------------------------------------------------

NOTIFICATION_META: dict = {
    # --- Customer ---
    "BOOKING_CONFIRMED": {
        "title": "Booking Confirmed",
        "icon": "check-circle",
        "color": "green",
        "role": "CUSTOMER",
    },
    "BOOKING_CANCELLED": {
        "title": "Booking Cancelled",
        "icon": "x-circle",
        "color": "red",
        "role": "CUSTOMER",
    },
    "TICKET_ISSUED": {
        "title": "E-Ticket Issued",
        "icon": "ticket",
        "color": "blue",
        "role": "CUSTOMER",
    },
    "DEPARTURE_REMINDER": {
        "title": "Departure Reminder",
        "icon": "clock",
        "color": "orange",
        "role": "CUSTOMER",
    },
    "SCHEDULE_CHANGED": {
        "title": "Schedule Updated",
        "icon": "calendar",
        "color": "amber",
        "role": "CUSTOMER",
    },
    "BUS_DELAYED": {
        "title": "Bus Delayed",
        "icon": "alert-triangle",
        "color": "yellow",
        "role": "CUSTOMER",
    },
    "REFUND_INITIATED": {
        "title": "Refund Initiated",
        "icon": "refresh-cw",
        "color": "teal",
        "role": "CUSTOMER",
    },
    "REFUND_COMPLETED": {
        "title": "Refund Completed",
        "icon": "check",
        "color": "green",
        "role": "CUSTOMER",
    },

    # --- Operator ---
    "NEW_BOOKING_ALERT": {
        "title": "New Booking",
        "icon": "user-plus",
        "color": "blue",
        "role": "OPERATOR",
    },
    "DAILY_BOOKING_SUMMARY": {
        "title": "Daily Booking Summary",
        "icon": "bar-chart-2",
        "color": "indigo",
        "role": "OPERATOR",
    },
    "REVENUE_SUMMARY": {
        "title": "Revenue Summary",
        "icon": "trending-up",
        "color": "green",
        "role": "OPERATOR",
    },
    "ROUTE_UPDATE_CONFIRMED": {
        "title": "Route Update Confirmed",
        "icon": "map-pin",
        "color": "purple",
        "role": "OPERATOR",
    },
    "OPERATOR_TO_USER": {
        "title": "Message from Operator",
        "icon": "megaphone",
        "color": "blue",
        "role": "CUSTOMER",
    },

    # --- Admin ---
    "NEW_OPERATOR_REGISTERED": {
        "title": "New Operator Registered",
        "icon": "building",
        "color": "brand",
        "role": "ADMIN",
    },
    "NEW_USER_REGISTERED": {
        "title": "New User Registered",
        "icon": "user",
        "color": "brand",
        "role": "ADMIN",
    },
    "SYSTEM_ALERT": {
        "title": "System Alert",
        "icon": "alert-octagon",
        "color": "red",
        "role": "ADMIN",
    },
    "DAILY_PLATFORM_SUMMARY": {
        "title": "Daily Platform Summary",
        "icon": "activity",
        "color": "indigo",
        "role": "ADMIN",
    },
    "WEEKLY_REVENUE_REPORT": {
        "title": "Weekly Revenue Report",
        "icon": "dollar-sign",
        "color": "green",
        "role": "ADMIN",
    },
    "USER_COMPLAINT": {
        "title": "User Complaint Filed",
        "icon": "message-square",
        "color": "red",
        "role": "ADMIN",
    },
    "BOOKING_ANOMALY": {
        "title": "Booking Anomaly Detected",
        "icon": "zap",
        "color": "yellow",
        "role": "ADMIN",
    },
    "ADMIN_BROADCAST": {
        "title": "Platform Announcement",
        "icon": "megaphone",
        "color": "brand",
        "role": "CUSTOMER",
    },
}


def get_notification_title(notification_type: str) -> str:
    """Return a human-readable title for the given notification type key."""
    return NOTIFICATION_META.get(notification_type, {}).get("title", notification_type)
