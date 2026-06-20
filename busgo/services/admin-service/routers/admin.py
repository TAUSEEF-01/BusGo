from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncpg
import os
import uuid
from datetime import datetime
from shared.database_config import get_database_url
from database import get_db
from sqlalchemy.orm import Session
from models import Notice

router = APIRouter(tags=["admin"])


class NoticeCreate(BaseModel):
    title: str
    body: str
    is_active: bool = True


class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    is_active: Optional[bool] = None

class RoleUpdate(BaseModel):
    role: str

async def query_db(db_name: str, query: str):
    # In Docker, postgres is the host. Locally, it might be localhost.
    host = os.getenv("DB_HOST", "postgres")
    try:
        db_url = get_database_url(async_driver=False).replace("+asyncpg", "")
        conn = await asyncpg.connect(db_url, ssl="require", statement_cache_size=0)
        val = await conn.fetchval(query)
        await conn.close()
        return val
    except Exception as e:
        print(f"Error querying {db_name}: {e}")
        return 0

async def query_db_all(db_name: str, query: str):
    host = os.getenv("DB_HOST", "postgres")
    try:
        db_url = get_database_url(async_driver=False).replace("+asyncpg", "")
        conn = await asyncpg.connect(db_url, ssl="require", statement_cache_size=0)
        records = await conn.fetch(query)
        await conn.close()
        return [dict(record) for record in records]
    except Exception as e:
        print(f"Error querying {db_name}: {e}")
        return []

async def execute_db(db_name: str, query: str, *args):
    host = os.getenv("DB_HOST", "postgres")
    try:
        db_url = get_database_url(async_driver=False).replace("+asyncpg", "")
        conn = await asyncpg.connect(db_url, ssl="require", statement_cache_size=0)
        status = await conn.execute(query, *args)
        await conn.close()
        return status
    except Exception as e:
        print(f"Error executing in {db_name}: {e}")
        return None

@router.get("/dashboard-stats")
async def get_dashboard_stats():
    # Gather statistics across microservice databases
    
    # Total Users
    total_users = await query_db("auth_db", "SELECT COUNT(id) FROM users")
    
    # Total Bookings
    total_bookings = await query_db("booking_db", "SELECT COUNT(id) FROM bookings")
    
    # Total Revenue (sum of total_fare for confirmed/completed bookings only)
    total_revenue = await query_db("booking_db", "SELECT COALESCE(SUM(total_fare), 0) FROM bookings WHERE status IN ('CONFIRMED', 'COMPLETED')")
    
    # Active Operators
    # If operator_db doesn't exist or is empty, we fallback.
    active_operators = await query_db("operator_db", "SELECT COUNT(id) FROM operators WHERE is_active = true")

    return {
        "success": True,
        "data": {
            "totalUsers": total_users,
            "totalBookings": total_bookings,
            "totalRevenue": float(total_revenue),
            "activeOperators": active_operators
        }
    }

@router.get("/operators")
async def get_operators():
    operators = await query_db_all("operator_db", "SELECT id, name, contact_phone, contact_email, address, license_no, is_active FROM operators")
    for op in operators:
        if isinstance(op.get('id'), uuid.UUID):
            op['id'] = str(op['id'])
    return {"success": True, "data": operators}

@router.get("/routes")
async def get_routes():
    routes = await query_db_all("operator_db", "SELECT id, operator_id, origin_city, destination_city, distance_km, estimated_duration_hours FROM routes")
    for r in routes:
        if isinstance(r.get('id'), uuid.UUID):
            r['id'] = str(r['id'])
        if isinstance(r.get('operator_id'), uuid.UUID):
            r['operator_id'] = str(r['operator_id'])
    return {"success": True, "data": routes}

@router.get("/users")
async def get_users():
    users = await query_db_all("auth_db", "SELECT id, full_name, email, phone, role, is_verified, created_at FROM users")
    for u in users:
        if isinstance(u.get('id'), uuid.UUID):
            u['id'] = str(u['id'])
        if 'created_at' in u and u['created_at']:
            u['created_at'] = u['created_at'].isoformat()
    return {"success": True, "data": users}

@router.patch("/users/{user_id}/role")
async def update_user_role(user_id: str, req: RoleUpdate):
    if req.role not in ["ADMIN", "CUSTOMER", "OPERATOR"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    query = "UPDATE users SET role = $1::user_role WHERE id = $2"
    status = await execute_db("auth_db", query, req.role, uuid.UUID(user_id))
    if not status:
        raise HTTPException(status_code=500, detail="Failed to update role in database")
        
    return {"success": True, "message": f"User role updated to {req.role}"}

@router.get("/user-history")
async def get_user_history():
    bookings = await query_db_all("booking_db", "SELECT id, user_id, trip_id, status, journey_date, created_at, total_fare FROM bookings ORDER BY created_at DESC LIMIT 100")
    users = await query_db_all("auth_db", "SELECT id, full_name, email, phone FROM users")
    
    # Map user info to bookings
    user_map = {str(u['id']): u for u in users}
    
    for b in bookings:
        if isinstance(b.get('id'), uuid.UUID):
            b['id'] = str(b['id'])
        uid = str(b.get('user_id'))
        b['user_id'] = uid
        if isinstance(b.get('trip_id'), uuid.UUID):
            b['trip_id'] = str(b['trip_id'])
        if 'journey_date' in b and b['journey_date']:
            b['journey_date'] = b['journey_date'].isoformat()
        if 'created_at' in b and b['created_at']:
            b['created_at'] = b['created_at'].isoformat()
            
        b['user'] = user_map.get(uid, {"full_name": "Unknown", "phone": ""})
        
    return {"success": True, "data": bookings}

@router.get("/transactions")
async def get_transactions():
    payments = await query_db_all("payment_db", "SELECT id, user_id, amount, method, status, initiated_at FROM payments ORDER BY initiated_at DESC LIMIT 100")
    users = await query_db_all("auth_db", "SELECT id, full_name, email, phone FROM users")
    
    # Map user info to payments
    user_map = {str(u['id']): u for u in users}
    
    for p in payments:
        if isinstance(p.get('id'), uuid.UUID):
            p['id'] = str(p['id'])
            
        uid = str(p.get('user_id'))
        p['user_id'] = uid
        
        if 'initiated_at' in p and p['initiated_at']:
            p['initiated_at'] = p['initiated_at'].isoformat()
        
        # safely convert Decimal to float
        if 'amount' in p and p['amount'] is not None:
            p['amount'] = float(p['amount'])
            
        p['user'] = user_map.get(uid, {"full_name": "Unknown User", "phone": ""})
            
    return {"success": True, "data": payments}

@router.get("/transactions/summary")
async def get_transactions_summary():
    query = """
        SELECT DATE(initiated_at) as date, SUM(amount) as total
        FROM payments
        GROUP BY DATE(initiated_at)
        ORDER BY DATE(initiated_at) ASC
    """
    summary = await query_db_all("payment_db", query)
    
    # Formatting output correctly
    formatted_summary = []
    for s in summary:
        formatted_summary.append({
            "date": s['date'].isoformat() if s.get('date') else "Unknown",
            "total": float(s['total']) if s.get('total') is not None else 0.0
        })
        
    return {"success": True, "data": formatted_summary}

@router.get("/trips")
async def get_trips():
    trips = await query_db_all("operator_db", "SELECT id, operator_id, bus_id, route_id, departure_datetime, arrival_datetime, fare_amount, available_seats, status FROM trips")
    for t in trips:
        if isinstance(t.get('id'), uuid.UUID):
            t['id'] = str(t['id'])
        if isinstance(t.get('operator_id'), uuid.UUID):
            t['operator_id'] = str(t['operator_id'])
        if isinstance(t.get('bus_id'), uuid.UUID):
            t['bus_id'] = str(t['bus_id'])
        if isinstance(t.get('route_id'), uuid.UUID):
            t['route_id'] = str(t['route_id'])
        if 'departure_datetime' in t and t['departure_datetime']:
            t['departure_datetime'] = t['departure_datetime'].isoformat()
        if 'arrival_datetime' in t and t['arrival_datetime']:
            t['arrival_datetime'] = t['arrival_datetime'].isoformat()
        if 'fare_amount' in t and t['fare_amount'] is not None:
            t['fare_amount'] = float(t['fare_amount'])
    return {"success": True, "data": trips}


def _notice_to_dict(n: Notice) -> dict:
    return {
        "id": str(n.id),
        "title": n.title,
        "body": n.body,
        "is_active": n.is_active,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


@router.get("/notices")
def get_notices(db: Session = Depends(get_db)):
    notices = db.query(Notice).order_by(Notice.created_at.desc()).all()
    return {"success": True, "data": [_notice_to_dict(n) for n in notices]}


@router.get("/notices/active")
def get_active_notices(db: Session = Depends(get_db)):
    notices = db.query(Notice).filter(Notice.is_active == True).order_by(Notice.created_at.desc()).all()
    return {"success": True, "data": [_notice_to_dict(n) for n in notices]}


@router.post("/notices")
def create_notice(req: NoticeCreate, db: Session = Depends(get_db)):
    notice = Notice(title=req.title, body=req.body, is_active=req.is_active)
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return {"success": True, "data": _notice_to_dict(notice)}


@router.patch("/notices/{notice_id}")
def update_notice(notice_id: str, req: NoticeUpdate, db: Session = Depends(get_db)):
    notice = db.query(Notice).filter(Notice.id == uuid.UUID(notice_id)).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    if req.title is not None:
        notice.title = req.title
    if req.body is not None:
        notice.body = req.body
    if req.is_active is not None:
        notice.is_active = req.is_active
    notice.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(notice)
    return {"success": True, "data": _notice_to_dict(notice)}


@router.delete("/notices/{notice_id}")
def delete_notice(notice_id: str, db: Session = Depends(get_db)):
    notice = db.query(Notice).filter(Notice.id == uuid.UUID(notice_id)).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    db.delete(notice)
    db.commit()
    return {"success": True, "message": "Notice deleted"}
