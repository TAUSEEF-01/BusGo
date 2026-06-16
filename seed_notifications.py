"""
seed_notifications.py
=====================
Seeds the in_app_notifications table with realistic, backdated notifications
derived from actual database activity (users, bookings, payments, trips, operators).

This makes the notification system look like it has been running since
the app was first set up.

Run:  python seed_notifications.py
"""

import uuid
import json
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, text, inspect
from urllib.parse import quote_plus

# ─── Database connection ─────────────────────────────────────────────────────

pw = quote_plus("BusGoLet'sGo")
DATABASE_URL = (
    f"postgresql://postgres.wtldkwqnfynxfqyqvehy:{pw}"
    f"@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
)
engine = create_engine(DATABASE_URL, connect_args={"sslmode": "require"})

# ─── Table creation (if not exists) ──────────────────────────────────────────

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS in_app_notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    role            VARCHAR NOT NULL,
    type            VARCHAR NOT NULL,
    title           VARCHAR NOT NULL,
    message         TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}',
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    read_at         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_in_app_notifications_user_id
    ON in_app_notifications(user_id);

CREATE INDEX IF NOT EXISTS ix_in_app_notifications_created_at
    ON in_app_notifications(created_at DESC);
"""

# ─── Helper ──────────────────────────────────────────────────────────────────

def make_notif(user_id, role, ntype, title, message, metadata, created_at, is_read=True, read_at=None):
    """Build a notification dict ready for insert."""
    nid = str(uuid.uuid4())
    if is_read and read_at is None:
        # Read ~5-30 min after creation
        read_at = created_at + timedelta(minutes=random.randint(5, 30))
    return {
        "id": nid,
        "user_id": str(user_id),
        "role": role,
        "type": ntype,
        "title": title,
        "message": message,
        "metadata": json.dumps(metadata),
        "is_read": is_read,
        "created_at": created_at.isoformat(),
        "read_at": read_at.isoformat() if read_at else None,
    }


def minutes_after(dt, m):
    return dt + timedelta(minutes=m)


# ─── Actual data from the DB ─────────────────────────────────────────────────

# Users
USERS = {
    # Admins
    "7b1394fc-06c7-4cd3-93b2-88310acef88d": {"name": "Admin User",    "email": "admin@busgo.com",    "role": "ADMIN",    "created": datetime(2026, 5, 16, 18, 37, tzinfo=timezone.utc)},
    "9fb2d5d4-0ca7-4eec-bbab-ca88d52272f1": {"name": "BusGo Admin",   "email": "admin2@busgo.com",   "role": "ADMIN",    "created": datetime(2026, 6, 14, 18, 1, tzinfo=timezone.utc)},
    # Operators
    "d27c1afc-57c5-4832-92dc-db6e64039aad": {"name": "operator1",     "email": "operator1@gmail.com","role": "OPERATOR", "created": datetime(2026, 5, 16, 19, 14, tzinfo=timezone.utc)},
    "0e0eff61-0ae1-4bcc-9c59-812f93b9e754": {"name": "operator2",     "email": "operator2@gmail.com","role": "OPERATOR", "created": datetime(2026, 5, 26, 1, 11, tzinfo=timezone.utc)},
    # Customers
    "1d995144-9b88-4f1b-a427-9693326aa6be": {"name": "Test User",     "email": "test1@test.com",     "role": "CUSTOMER", "created": datetime(2026, 5, 16, 18, 50, tzinfo=timezone.utc)},
    "bab5dabb-a677-46be-a1ae-be6d58d80d32": {"name": "Final Test",    "email": "final@test.com",     "role": "CUSTOMER", "created": datetime(2026, 5, 16, 19, 9, tzinfo=timezone.utc)},
    "8b16bde4-8744-458a-8749-1d30cef3b51b": {"name": "Kong Test",     "email": "kong@test.com",      "role": "CUSTOMER", "created": datetime(2026, 5, 16, 19, 11, tzinfo=timezone.utc)},
    "30e8b247-39cc-4d22-9a25-7da10ee58134": {"name": "Tauseef",       "email": "user1@gmail.com",    "role": "CUSTOMER", "created": datetime(2026, 5, 16, 19, 12, tzinfo=timezone.utc)},
    "7fb5a975-12d8-41dc-8b44-e2ab06d7b4ba": {"name": "user2",         "email": "user2@gmail.com",    "role": "CUSTOMER", "created": datetime(2026, 5, 17, 13, 57, tzinfo=timezone.utc)},
    "37088e65-0b5f-49ea-86d6-9b31671367b9": {"name": "Bank Test",     "email": "banktest1781478181@example.com", "role": "CUSTOMER", "created": datetime(2026, 6, 14, 17, 3, tzinfo=timezone.utc)},
    "9a2e2da2-6b0b-4272-85c7-6c87f4e6de25": {"name": "tauseef",       "email": "tauseef@gmail.com",  "role": "CUSTOMER", "created": datetime(2026, 6, 14, 20, 8, tzinfo=timezone.utc)},
}

ADMIN_IDS = [uid for uid, u in USERS.items() if u["role"] == "ADMIN"]
OPERATOR_ID_1 = "d27c1afc-57c5-4832-92dc-db6e64039aad"

# Real bookings from the DB
BOOKINGS = [
    {
        "id": "06d60edc-8947-4174-9780-a016932f5dc3",
        "user_id": "30e8b247-39cc-4d22-9a25-7da10ee58134",
        "user_name": "Tauseef",
        "operator_id": OPERATOR_ID_1,
        "origin": "Dhaka", "dest": "Comilla",
        "boarding": "DigiLab", "dropping": "Comilla Cantonment Road Junction",
        "date": "2026-06-14", "fare": 1520, "status": "CONFIRMED",
        "seats": ["A3", "A4", "B4"],
        "created": datetime(2026, 6, 14, 16, 41, tzinfo=timezone.utc),
    },
    {
        "id": "3e8577c6-e0ac-4247-a751-65bbab2361e1",
        "user_id": "9a2e2da2-6b0b-4272-85c7-6c87f4e6de25",
        "user_name": "tauseef",
        "operator_id": OPERATOR_ID_1,
        "origin": "Dhaka", "dest": "Comilla",
        "boarding": "DigiLab", "dropping": "Comilla Cantonment Road Junction",
        "date": "2026-06-18", "fare": 2020, "status": "CANCELLED",
        "seats": ["B3", "B4", "C3", "C4"],
        "created": datetime(2026, 6, 14, 20, 11, tzinfo=timezone.utc),
    },
    {
        "id": "ec94be9b-41aa-4f40-923b-c80bbde600b0",
        "user_id": "9a2e2da2-6b0b-4272-85c7-6c87f4e6de25",
        "user_name": "tauseef",
        "operator_id": OPERATOR_ID_1,
        "origin": "Dhaka", "dest": "Sylhet",
        "boarding": "Hotel Melody", "dropping": "Sonali Bank Limited",
        "date": "2026-06-21", "fare": 1020, "status": "CANCELLED",
        "seats": ["C2", "C3"],
        "created": datetime(2026, 6, 14, 20, 38, tzinfo=timezone.utc),
    },
    {
        "id": "6e34f297-0264-4145-b536-bf004b96b9da",
        "user_id": "9a2e2da2-6b0b-4272-85c7-6c87f4e6de25",
        "user_name": "tauseef",
        "operator_id": OPERATOR_ID_1,
        "origin": "Dhaka", "dest": "Sylhet",
        "boarding": "Hotel Melody", "dropping": "Sonali Bank Limited",
        "date": "2026-06-18", "fare": 1520, "status": "CONFIRMED",
        "seats": ["D3", "D4", "C4"],
        "created": datetime(2026, 6, 14, 21, 43, tzinfo=timezone.utc),
    },
    {
        "id": "1cf2ead5-e3cb-4437-8173-2e22db29ceaa",
        "user_id": "30e8b247-39cc-4d22-9a25-7da10ee58134",
        "user_name": "Tauseef",
        "operator_id": OPERATOR_ID_1,
        "origin": "Dhaka", "dest": "Comilla",
        "boarding": "Dhaka", "dropping": "Comilla",
        "date": "2026-06-18", "fare": 1020, "status": "CANCELLED",
        "seats": ["E4", "F4"],
        "created": datetime(2026, 6, 15, 6, 55, tzinfo=timezone.utc),
    },
    {
        "id": "f73a9267-ea10-4c25-805b-cefb9eee75fa",
        "user_id": "30e8b247-39cc-4d22-9a25-7da10ee58134",
        "user_name": "Tauseef",
        "operator_id": OPERATOR_ID_1,
        "origin": "Dhaka", "dest": "Comilla",
        "boarding": "Dhaka", "dropping": "Comilla",
        "date": "2026-06-28", "fare": 520, "status": "CONFIRMED",
        "seats": ["H3"],
        "created": datetime(2026, 6, 15, 7, 20, tzinfo=timezone.utc),
    },
]


# ─── Build all notifications ─────────────────────────────────────────────────

all_notifs = []

# ═══════════════════════════════════════════════════════════════════════════════
#  1. CUSTOMER NOTIFICATIONS — based on actual bookings
# ═══════════════════════════════════════════════════════════════════════════════

for bk in BOOKINGS:
    uid = bk["user_id"]
    created = bk["created"]
    seats_str = ", ".join(bk["seats"])
    route_str = f"{bk['origin']} -> {bk['dest']}"
    meta = {
        "booking_id": bk["id"],
        "origin": bk["origin"],
        "dest": bk["dest"],
        "date": bk["date"],
        "seats": seats_str,
        "fare": bk["fare"],
    }

    if bk["status"] == "CONFIRMED":
        # ── Booking Confirmed ──
        all_notifs.append(make_notif(
            uid, "CUSTOMER", "BOOKING_CONFIRMED", "Booking Confirmed",
            f"Booking confirmed! Ref: {bk['id'][:8]}. {route_str} on {bk['date']}. Seat(s): {seats_str}.",
            meta, minutes_after(created, 1),
        ))
        # ── Ticket Issued (2 min after booking) ──
        all_notifs.append(make_notif(
            uid, "CUSTOMER", "TICKET_ISSUED", "E-Ticket Issued",
            f"Your e-ticket for booking {bk['id'][:8]} is ready. Tap to download.",
            meta, minutes_after(created, 2),
        ))
        # ── Departure Reminder (for bookings with past or near-future journey date) ──
        journey_dt = datetime.strptime(bk["date"], "%Y-%m-%d").replace(hour=18, tzinfo=timezone.utc)
        reminder_time = journey_dt - timedelta(hours=2)
        if reminder_time > created and reminder_time < datetime.now(timezone.utc):
            all_notifs.append(make_notif(
                uid, "CUSTOMER", "DEPARTURE_REMINDER", "Departure Reminder",
                f"Your bus departs in ~2 hours from {bk['boarding']}. Have a safe journey!",
                meta, reminder_time,
            ))

    elif bk["status"] == "CANCELLED":
        # ── Booking Confirmed first (it was confirmed before cancellation) ──
        all_notifs.append(make_notif(
            uid, "CUSTOMER", "BOOKING_CONFIRMED", "Booking Confirmed",
            f"Booking confirmed! Ref: {bk['id'][:8]}. {route_str} on {bk['date']}. Seat(s): {seats_str}.",
            meta, minutes_after(created, 1),
        ))
        # ── Then Cancelled (few minutes later) ──
        cancel_time = minutes_after(created, random.randint(10, 60))
        all_notifs.append(make_notif(
            uid, "CUSTOMER", "BOOKING_CANCELLED", "Booking Cancelled",
            f"Booking {bk['id'][:8]} has been cancelled. Refund of {bk['fare']} BDT initiated.",
            {**meta, "amount": bk["fare"]}, cancel_time,
        ))
        # ── Refund Initiated ──
        all_notifs.append(make_notif(
            uid, "CUSTOMER", "REFUND_INITIATED", "Refund Initiated",
            f"Refund of {bk['fare']} BDT for booking {bk['id'][:8]} has been initiated. It will arrive in 3-5 business days.",
            {**meta, "amount": bk["fare"]}, minutes_after(cancel_time, 2),
        ))

    elif bk["status"] == "EXPIRED":
        # Just the initial booking notification, already read
        all_notifs.append(make_notif(
            uid, "CUSTOMER", "BOOKING_CONFIRMED", "Booking Confirmed",
            f"Booking confirmed! Ref: {bk['id'][:8]}. {route_str} on {bk['date']}. Seat(s): {seats_str}.",
            meta, minutes_after(created, 1),
        ))


# ═══════════════════════════════════════════════════════════════════════════════
#  2. OPERATOR NOTIFICATIONS — based on the same bookings
# ═══════════════════════════════════════════════════════════════════════════════

# Group bookings by operator for daily summaries
for bk in BOOKINGS:
    op_id = bk["operator_id"]
    created = bk["created"]
    route_str = f"{bk['origin']} -> {bk['dest']}"
    seats_count = len(bk["seats"])

    if bk["status"] in ("CONFIRMED", "CANCELLED"):
        # New booking alert for operator
        all_notifs.append(make_notif(
            op_id, "OPERATOR", "NEW_BOOKING_ALERT", "New Booking",
            f"{seats_count} seat(s) booked on your bus for {route_str} on {bk['date']}. "
            f"Fare collected: {bk['fare']} BDT. Booking ref: {bk['id'][:8]}.",
            {
                "booking_id": bk["id"], "origin": bk["origin"], "destination": bk["dest"],
                "trip_date": bk["date"], "seats_booked": seats_count,
                "total_fare": bk["fare"], "customer_name": bk["user_name"],
            },
            minutes_after(created, 1),
        ))

    if bk["status"] == "CANCELLED":
        cancel_time = minutes_after(created, random.randint(10, 60))
        all_notifs.append(make_notif(
            op_id, "OPERATOR", "BOOKING_CANCELLED", "Booking Cancelled",
            f"Booking {bk['id'][:8]} for {route_str} on {bk['date']} has been cancelled by the customer.",
            {"booking_id": bk["id"], "origin": bk["origin"], "destination": bk["dest"], "trip_date": bk["date"]},
            cancel_time,
        ))

# ── Operator Daily Summaries (retroactive) ──
# Generate daily summaries for June 14 and June 15
for day_offset, date_str, bookings_count, revenue in [
    (0, "June 14, 2026", 5, 8100),
    (1, "June 15, 2026", 3, 2560),
]:
    summary_time = datetime(2026, 6, 14 + day_offset, 23, 0, tzinfo=timezone.utc)
    all_notifs.append(make_notif(
        OPERATOR_ID_1, "OPERATOR", "DAILY_BOOKING_SUMMARY", "Daily Booking Summary",
        f"Daily Summary ({date_str}): {bookings_count} booking(s) across all your routes. Total revenue: {revenue} BDT.",
        {"total_bookings": bookings_count, "total_revenue": revenue, "date": date_str},
        summary_time,
        is_read=(day_offset == 0),  # June 15 summary is unread
    ))

# ── Operator Revenue Summary (weekly — sent on Sunday June 15 at 8 AM) ──
all_notifs.append(make_notif(
    OPERATOR_ID_1, "OPERATOR", "REVENUE_SUMMARY", "Revenue Summary",
    "Revenue Summary (Week of June 9 - June 15): 8 bookings, total revenue 10,660 BDT.",
    {"week_bookings": 8, "week_revenue": 10660, "period": "June 9 - June 15, 2026"},
    datetime(2026, 6, 15, 8, 0, tzinfo=timezone.utc),
    is_read=False,  # Unread
))

# ── Operator Route Update ──
all_notifs.append(make_notif(
    OPERATOR_ID_1, "OPERATOR", "ROUTE_UPDATE_CONFIRMED", "Route Update Confirmed",
    "Your update to 'Dhaka -> Sylhet' route has been reviewed and confirmed.",
    {"route_name": "Dhaka -> Sylhet"},
    datetime(2026, 6, 13, 17, 0, tzinfo=timezone.utc),
))

# ═══════════════════════════════════════════════════════════════════════════════
#  3. ADMIN NOTIFICATIONS — platform activity
# ═══════════════════════════════════════════════════════════════════════════════

primary_admin = ADMIN_IDS[0]  # Admin User

# ── New User Registrations (for each user) ──
for uid, u in USERS.items():
    if u["role"] == "CUSTOMER":
        all_notifs.append(make_notif(
            primary_admin, "ADMIN", "NEW_USER_REGISTERED", "New User Registered",
            f"{u['name']} ({u['email']}) has created an account.",
            {"user_name": u["name"], "user_email": u["email"], "user_id": uid},
            minutes_after(u["created"], 1),
        ))

# ── New Operator Registrations ──
for uid, u in USERS.items():
    if u["role"] == "OPERATOR":
        all_notifs.append(make_notif(
            primary_admin, "ADMIN", "NEW_OPERATOR_REGISTERED", "New Operator Registered",
            f"{u['name']} ({u['email']}) has registered as an operator and is pending review.",
            {"operator_name": u["name"], "operator_email": u["email"], "operator_id": uid},
            minutes_after(u["created"], 1),
        ))

# ── Admin also gets notified for 2nd admin registration ──
all_notifs.append(make_notif(
    primary_admin, "ADMIN", "NEW_USER_REGISTERED", "New User Registered",
    "BusGo Admin (admin2@busgo.com) has created an admin account.",
    {"user_name": "BusGo Admin", "user_email": "admin2@busgo.com"},
    datetime(2026, 6, 14, 18, 2, tzinfo=timezone.utc),
))

# ── Daily Platform Summaries ──
platform_summaries = [
    ("May 16, 2026", datetime(2026, 5, 17, 0, 0, tzinfo=timezone.utc), 7, 0, 7),
    ("May 17, 2026", datetime(2026, 5, 18, 0, 0, tzinfo=timezone.utc), 1, 0, 8),
    ("May 26, 2026", datetime(2026, 5, 27, 0, 0, tzinfo=timezone.utc), 1, 0, 9),
    ("June 13, 2026", datetime(2026, 6, 14, 0, 0, tzinfo=timezone.utc), 0, 0, 10),
    ("June 14, 2026", datetime(2026, 6, 15, 0, 0, tzinfo=timezone.utc), 3, 8100, 11),
]
for date_str, ts, new_users, revenue, total_users in platform_summaries:
    all_notifs.append(make_notif(
        primary_admin, "ADMIN", "DAILY_PLATFORM_SUMMARY", "Daily Platform Summary",
        f"Platform Daily Summary ({date_str}): {new_users} new user(s), "
        f"{total_users} total users, revenue: {revenue} BDT.",
        {"date": date_str, "new_users": new_users, "total_revenue": revenue, "active_users": total_users},
        ts,
    ))

# ── Weekly Revenue Report ──
all_notifs.append(make_notif(
    primary_admin, "ADMIN", "WEEKLY_REVENUE_REPORT", "Weekly Revenue Report",
    "Weekly Revenue Report (June 9 - June 15): 8 total bookings, "
    "platform revenue: 10,660 BDT. Operator payouts: 9,594 BDT.",
    {"week_bookings": 8, "week_revenue": 10660, "period": "June 9 - June 15, 2026"},
    datetime(2026, 6, 15, 8, 0, tzinfo=timezone.utc),
    is_read=False,  # Recent — unread
))

# ── System Alert (one alert a few days ago — already read) ──
all_notifs.append(make_notif(
    primary_admin, "ADMIN", "SYSTEM_ALERT", "System Alert",
    "[System Alert] payment-service: Gateway timeout detected on bKash integration. Retrying automatically.",
    {"service": "payment-service", "detail": "Gateway timeout on bKash integration"},
    datetime(2026, 6, 13, 14, 30, tzinfo=timezone.utc),
))

# ── System Alert (recent — unread) ──
all_notifs.append(make_notif(
    primary_admin, "ADMIN", "SYSTEM_ALERT", "System Alert",
    "[System Alert] booking-service: 2 seat lock expirations detected in last hour. No customer impact.",
    {"service": "booking-service", "detail": "2 seat lock expirations in last hour"},
    datetime(2026, 6, 15, 5, 0, tzinfo=timezone.utc),
    is_read=False,
))

# ── Duplicate some admin notifs to the 2nd admin ──
second_admin = ADMIN_IDS[1] if len(ADMIN_IDS) > 1 else primary_admin
if second_admin != primary_admin:
    # 2nd admin gets recent activity only (registered June 14)
    for bk in BOOKINGS:
        if bk["created"] >= datetime(2026, 6, 14, 18, 0, tzinfo=timezone.utc):
            route_str = f"{bk['origin']} -> {bk['dest']}"
            all_notifs.append(make_notif(
                second_admin, "ADMIN", "DAILY_PLATFORM_SUMMARY", "Daily Platform Summary",
                f"Booking activity: {bk['user_name']} booked {route_str} ({bk['status']}).",
                {"booking_id": bk["id"]},
                minutes_after(bk["created"], 2),
                is_read=False,
            ))

# ═══════════════════════════════════════════════════════════════════════════════
#  4. SOME EXTRA SCHEDULE / DELAY NOTIFICATIONS for realism
# ═══════════════════════════════════════════════════════════════════════════════

# Schedule change for a trip on June 14 (affects Tauseef's booking)
all_notifs.append(make_notif(
    "30e8b247-39cc-4d22-9a25-7da10ee58134", "CUSTOMER", "SCHEDULE_CHANGED", "Schedule Updated",
    "Your trip from Dhaka to Comilla has been rescheduled. Old time: 6:00 PM -> New time: 6:30 PM. Booking ref: 06d60edc.",
    {"origin": "Dhaka", "destination": "Comilla", "old_departure_time": "6:00 PM", "new_departure_time": "6:30 PM", "booking_id": "06d60edc"},
    datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc),
))

# Bus delay notification for the same trip
all_notifs.append(make_notif(
    "30e8b247-39cc-4d22-9a25-7da10ee58134", "CUSTOMER", "BUS_DELAYED", "Bus Delayed",
    "Your bus from Dhaka to Comilla is delayed by approximately 15 minute(s). We apologise for the inconvenience.",
    {"origin": "Dhaka", "destination": "Comilla", "delay_minutes": 15},
    datetime(2026, 6, 14, 16, 0, tzinfo=timezone.utc),
))

# ═══════════════════════════════════════════════════════════════════════════════
#  5. MARK SOME RECENT ONES AS UNREAD for realism
# ═══════════════════════════════════════════════════════════════════════════════

now = datetime.now(timezone.utc)
for n in all_notifs:
    created = datetime.fromisoformat(n["created_at"])
    # Keep anything within the last 24 hours as unread
    if (now - created).total_seconds() < 86400:
        n["is_read"] = False
        n["read_at"] = None


# ═══════════════════════════════════════════════════════════════════════════════
#  INSERT INTO DATABASE
# ═══════════════════════════════════════════════════════════════════════════════

INSERT_SQL = text("""
    INSERT INTO in_app_notifications
        (id, user_id, role, type, title, message, metadata, is_read, created_at, read_at)
    VALUES
        (CAST(:id AS UUID), CAST(:user_id AS UUID), :role, :type, :title, :message,
         CAST(:metadata AS JSONB), :is_read, CAST(:created_at AS TIMESTAMP), CAST(:read_at AS TIMESTAMP))
""")


def main():
    print(f"[SEED] {len(all_notifs)} notifications to seed\n")

    with engine.begin() as conn:
        # Create table
        print("[DB] Creating in_app_notifications table (if not exists)...")
        for stmt in CREATE_TABLE_SQL.strip().split(";"):
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt))
        print("   [OK] Table ready\n")

        # Clear existing seeded data
        existing = conn.execute(text("SELECT COUNT(*) FROM in_app_notifications")).scalar()
        if existing > 0:
            print(f"[CLEAN] Clearing {existing} existing notifications...")
            conn.execute(text("DELETE FROM in_app_notifications"))
            print("   [OK] Cleared\n")

        # Insert
        print("[INSERT] Inserting notifications...")
        for i, n in enumerate(all_notifs):
            try:
                conn.execute(INSERT_SQL, n)
            except Exception as e:
                print(f"   [FAIL] #{i}: {e}")
                print(f"      Data: {n}")

        final_count = conn.execute(text("SELECT COUNT(*) FROM in_app_notifications")).scalar()
        print(f"\n[DONE] {final_count} notifications in the database.\n")

        # Summary by role
        for role in ["CUSTOMER", "OPERATOR", "ADMIN"]:
            count = conn.execute(text(f"SELECT COUNT(*) FROM in_app_notifications WHERE role = '{role}'")).scalar()
            unread = conn.execute(text(f"SELECT COUNT(*) FROM in_app_notifications WHERE role = '{role}' AND is_read = false")).scalar()
            print(f"   {role}: {count} total, {unread} unread")

        # Summary by user
        print("\nPer-user breakdown:")
        rows = conn.execute(text(
            "SELECT user_id, role, COUNT(*), COUNT(*) FILTER (WHERE is_read = false) "
            "FROM in_app_notifications GROUP BY user_id, role ORDER BY role, COUNT(*) DESC"
        )).fetchall()
        for r in rows:
            uid = str(r[0])
            uname = USERS.get(uid, {}).get("name", "?")
            print(f"   {uname:20s} ({r[1]:10s}): {r[2]:3d} total, {r[3]:2d} unread")


if __name__ == "__main__":
    main()
