"""Query bookings data for notification seeding."""
import sys; sys.stdout.reconfigure(encoding='utf-8')
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus

pw = quote_plus("BusGoLet'sGo")
url = f'postgresql://postgres.wtldkwqnfynxfqyqvehy:{pw}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres'
engine = create_engine(url, connect_args={'sslmode': 'require'})

with engine.connect() as conn:
    rows = conn.execute(text(
        "SELECT id, user_id, operator_id, boarding_point, dropping_point, "
        "journey_date, total_fare, status, seat_numbers, created_at "
        "FROM bookings ORDER BY created_at"
    )).fetchall()
    print(f'BOOKINGS: {len(rows)}')
    for r in rows:
        print(f'  id={r[0]} | user={r[1]} | op={r[2]} | {r[3]}->{r[4]} | date={r[5]} | fare={r[6]} | status={r[7]} | seats={r[8]} | created={r[9]}')

    # Payments
    rows2 = conn.execute(text(
        "SELECT id, booking_id, user_id, amount, method, status, initiated_at FROM payments ORDER BY initiated_at"
    )).fetchall()
    print(f'\nPAYMENTS: {len(rows2)}')
    for r in rows2:
        print(f'  id={r[0]} | booking={r[1]} | user={r[2]} | amt={r[3]} | method={r[4]} | status={r[5]} | at={r[6]}')
