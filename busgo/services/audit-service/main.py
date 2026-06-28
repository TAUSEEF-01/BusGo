from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, date
from uuid import UUID
from typing import List, Optional
from database import engine, Base, get_db
from models import AuditLog
from schemas import AuditLogResponse
from consumer import run_consumer_bg
from shared.observability import setup_observability
from shared.health import create_health_router, sqlalchemy_sync_check, redis_check
import uvicorn
import os

Base.metadata.create_all(bind=engine)

app = FastAPI(title='Audit Service', root_path=os.environ.get('ROOT_PATH', ''))

SERVICE_NAME = os.environ.get("SERVICE_NAME", "audit-service")
setup_observability(app, SERVICE_NAME)
app.include_router(create_health_router(SERVICE_NAME, {
    "database": sqlalchemy_sync_check(engine),
    "redis": redis_check(os.environ.get("REDIS_URL")),
}))

def verify_admin_role():
    return True

@app.on_event('startup')
async def startup_event():
    run_consumer_bg()

@app.get('/audit/logs', response_model=List[AuditLogResponse], dependencies=[Depends(verify_admin_role)])
def get_logs(
    event_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if event_type:
        query = query.filter(AuditLog.event_type == event_type)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
        
    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

@app.get('/audit/logs/booking/{booking_id}', response_model=List[AuditLogResponse], dependencies=[Depends(verify_admin_role)])
def get_logs_by_booking(
    booking_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db)
):
    # Mocking booking identity map 
    return db.query(AuditLog).filter(
        AuditLog.entity_id == booking_id
    ).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

@app.get('/audit/logs/user/{user_id}', response_model=List[AuditLogResponse], dependencies=[Depends(verify_admin_role)])
def get_logs_by_user(
    user_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db)
):
    return db.query(AuditLog).filter(
        AuditLog.user_id == user_id
    ).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

