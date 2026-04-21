import os

base_dir = "busgo/services/operator-service"
os.makedirs(f"{base_dir}/core", exist_ok=True)
os.makedirs(f"{base_dir}/api", exist_ok=True)
os.makedirs(f"{base_dir}/models", exist_ok=True)
os.makedirs(f"{base_dir}/schemas", exist_ok=True)
os.makedirs(f"{base_dir}/services", exist_ok=True)
os.makedirs(f"{base_dir}/routers", exist_ok=True)

with open(f"{base_dir}/core/config.py", "w") as f:
    f.write('''import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey-please-change-in-production")
    ALGORITHM: str = "HS256"
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

settings = Settings()
''')

with open(f"{base_dir}/models/base.py", "w") as f:
    f.write('''from sqlalchemy.orm import declarative_base
Base = declarative_base()
''')

with open(f"{base_dir}/models/models.py", "w") as f:
    f.write('''import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, Float, Integer, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum
from .base import Base

class BusType(str, enum.Enum):
    AC = 'AC'
    NON_AC = 'NON_AC'
    SLEEPER = 'SLEEPER'

class TripStatus(str, enum.Enum):
    SCHEDULED = 'SCHEDULED'
    CANCELLED = 'CANCELLED'
    COMPLETED = 'COMPLETED'

class Operator(Base):
    __tablename__ = "operators"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    contact_phone = Column(String, nullable=False)
    contact_email = Column(String, nullable=False)
    address = Column(String, nullable=False)
    license_no = Column(String, nullable=False)
    commission_rate = Column(Float, default=10.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    buses = relationship("Bus", back_populates="operator")
    routes = relationship("Route", back_populates="operator")
    trips = relationship("Trip", back_populates="operator")

class Bus(Base):
    __tablename__ = "buses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id"), nullable=False)
    registration_no = Column(String, unique=True, index=True, nullable=False)
    bus_type = Column(Enum(BusType), nullable=False)
    total_seats = Column(Integer, nullable=False)
    seat_layout = Column(JSONB, nullable=False)
    amenities = Column(JSONB, nullable=False)
    is_active = Column(Boolean, default=True)
    
    operator = relationship("Operator", back_populates="buses")
    trips = relationship("Trip", back_populates="bus")

class Route(Base):
    __tablename__ = "routes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id"), nullable=False)
    origin_city = Column(String, index=True, nullable=False)
    destination_city = Column(String, index=True, nullable=False)
    distance_km = Column(Float, nullable=False)
    estimated_duration_hours = Column(Float, nullable=False)
    boarding_points = Column(JSONB, nullable=False)
    dropping_points = Column(JSONB, nullable=False)

    operator = relationship("Operator", back_populates="routes")
    trips = relationship("Trip", back_populates="route")

class Trip(Base):
    __tablename__ = "trips"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id"), nullable=False)
    bus_id = Column(UUID(as_uuid=True), ForeignKey("buses.id"), nullable=False)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=False)
    departure_datetime = Column(DateTime(timezone=True), nullable=False)
    arrival_datetime = Column(DateTime(timezone=True), nullable=False)
    fare_amount = Column(Numeric(10, 2), nullable=False)
    available_seats = Column(Integer, nullable=False)
    status = Column(Enum(TripStatus), default=TripStatus.SCHEDULED)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    operator = relationship("Operator", back_populates="trips")
    bus = relationship("Bus", back_populates="trips")
    route = relationship("Route", back_populates="trips")
''')

with open(f"{base_dir}/schemas/schemas.py", "w") as f:
    f.write('''from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from models.models import BusType, TripStatus

class OperatorBase(BaseModel):
    name: str
    contact_phone: str
    contact_email: str
    address: str
    license_no: str
    commission_rate: Optional[float] = 10.0
    is_active: Optional[bool] = True

class OperatorCreate(OperatorBase):
    pass

class OperatorUpdate(BaseModel):
    name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    address: Optional[str] = None
    license_no: Optional[str] = None
    commission_rate: Optional[float] = None
    is_active: Optional[bool] = None

class OperatorResponse(OperatorBase):
    id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class Point(BaseModel):
    name: str
    address: str
    lat: float
    lng: float

class BusBase(BaseModel):
    registration_no: str
    bus_type: BusType
    total_seats: int
    seat_layout: Dict[str, Any]
    amenities: List[str]
    is_active: Optional[bool] = True

class BusCreate(BusBase):
    pass

class BusUpdate(BaseModel):
    registration_no: Optional[str] = None
    bus_type: Optional[BusType] = None
    total_seats: Optional[int] = None
    seat_layout: Optional[Dict[str, Any]] = None
    amenities: Optional[List[str]] = None
    is_active: Optional[bool] = None

class BusResponse(BusBase):
    id: UUID
    operator_id: UUID
    class Config:
        from_attributes = True

class RouteBase(BaseModel):
    origin_city: str
    destination_city: str
    distance_km: float
    estimated_duration_hours: float
    boarding_points: List[Point]
    dropping_points: List[Point]

class RouteCreate(RouteBase):
    pass

class RouteResponse(RouteBase):
    id: UUID
    operator_id: UUID
    class Config:
        from_attributes = True

class TripBase(BaseModel):
    bus_id: UUID
    route_id: UUID
    departure_datetime: datetime
    arrival_datetime: datetime
    fare_amount: float
    available_seats: int
    status: Optional[TripStatus] = TripStatus.SCHEDULED

class TripCreate(TripBase):
    operator_id: UUID

class TripUpdate(BaseModel):
    departure_datetime: Optional[datetime] = None
    arrival_datetime: Optional[datetime] = None
    fare_amount: Optional[float] = None
    available_seats: Optional[int] = None
    status: Optional[TripStatus] = None

class TripResponse(TripBase):
    id: UUID
    operator_id: UUID
    created_at: datetime
    class Config:
        from_attributes = True
''')

with open(f"{base_dir}/api/deps.py", "w") as f:
    f.write('''from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from core.config import settings

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user_payload(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("user_id")
        role: str = payload.get("role")
        if user_id is None or role is None:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception

def require_role(required_role: UserRole):
    def role_checker(payload: dict = Depends(get_current_user_payload)):
        if payload.get("role") != required_role.value:
            raise HTTPException(status_code=403, detail="Operation not permitted")
        return payload
    return role_checker
''')

with open(f"{base_dir}/routers/operators.py", "w") as f:
    f.write('''from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from database import get_db
from models.models import Operator
from schemas.schemas import OperatorCreate, OperatorUpdate, OperatorResponse
from api.deps import require_role

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.enums import UserRole

router = APIRouter(prefix="/operators", tags=["operators"])

@router.post("/register", response_model=BaseResponse[OperatorResponse])
async def register(req: OperatorCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(require_role(UserRole.ADMIN))):
    operator = Operator(**req.model_dump())
    db.add(operator)
    await db.commit()
    await db.refresh(operator)
    return BaseResponse(success=True, data=OperatorResponse.model_validate(operator), message="Operator registered")

@router.get("/{id}", response_model=BaseResponse[OperatorResponse])
async def get_operator(id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Operator).where(Operator.id == id))
    operator = result.scalars().first()
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    return BaseResponse(success=True, data=OperatorResponse.model_validate(operator))

@router.get("/", response_model=BaseResponse[List[OperatorResponse]])
async def list_operators(skip: int = Query(0, ge=0), limit: int = Query(20, gt=0), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Operator).offset(skip).limit(limit))
    operators = result.scalars().all()
    return BaseResponse(success=True, data=[OperatorResponse.model_validate(op) for op in operators])

@router.put("/{id}", response_model=BaseResponse[OperatorResponse])
async def update_operator(id: UUID, req: OperatorUpdate, db: AsyncSession = Depends(get_db), payload: dict = Depends(require_role(UserRole.ADMIN))):
    result = await db.execute(select(Operator).where(Operator.id == id))
    operator = result.scalars().first()
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(operator, key, value)
        
    await db.commit()
    await db.refresh(operator)
    return BaseResponse(success=True, data=OperatorResponse.model_validate(operator), message="Operator updated")
''')

with open(f"{base_dir}/routers/buses_routes.py", "w") as f:
    f.write('''from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID

from database import get_db
from models.models import Bus, Route, Operator
from schemas.schemas import BusCreate, BusUpdate, BusResponse, RouteCreate, RouteResponse
from api.deps import get_current_user_payload

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse

router = APIRouter(tags=["buses-routes"])

@router.post("/operators/{id}/buses", response_model=BaseResponse[BusResponse])
async def create_bus(id: UUID, req: BusCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    # Verify operator exists
    op_res = await db.execute(select(Operator).where(Operator.id == id))
    if not op_res.scalars().first():
        raise HTTPException(status_code=404, detail="Operator not found")
        
    bus = Bus(operator_id=id, **req.model_dump())
    db.add(bus)
    try:
        await db.commit()
        await db.refresh(bus)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Registration number might already exist")
        
    return BaseResponse(success=True, data=BusResponse.model_validate(bus), message="Bus created")

@router.get("/operators/{id}/buses", response_model=BaseResponse[List[BusResponse]])
async def list_operator_buses(id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bus).where(Bus.operator_id == id))
    buses = result.scalars().all()
    return BaseResponse(success=True, data=[BusResponse.model_validate(b) for b in buses])

@router.put("/buses/{id}", response_model=BaseResponse[BusResponse])
async def update_bus(id: UUID, req: BusUpdate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    result = await db.execute(select(Bus).where(Bus.id == id))
    bus = result.scalars().first()
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    
    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(bus, key, value)
        
    await db.commit()
    await db.refresh(bus)
    return BaseResponse(success=True, data=BusResponse.model_validate(bus), message="Bus updated")

@router.post("/operators/{id}/routes", response_model=BaseResponse[RouteResponse])
async def create_route(id: UUID, req: RouteCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    op_res = await db.execute(select(Operator).where(Operator.id == id))
    if not op_res.scalars().first():
        raise HTTPException(status_code=404, detail="Operator not found")
        
    # Convert Points to dict for JSON injection
    route_data = req.model_dump()
    route_data["boarding_points"] = [p for p in route_data["boarding_points"]]
    route_data["dropping_points"] = [p for p in route_data["dropping_points"]]
    
    route = Route(operator_id=id, **route_data)
    db.add(route)
    await db.commit()
    await db.refresh(route)
    return BaseResponse(success=True, data=RouteResponse.model_validate(route), message="Route created")

@router.get("/operators/{id}/routes", response_model=BaseResponse[List[RouteResponse]])
async def list_operator_routes(id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Route).where(Route.operator_id == id))
    routes = result.scalars().all()
    return BaseResponse(success=True, data=[RouteResponse.model_validate(r) for r in routes])

@router.get("/routes/", response_model=BaseResponse[List[RouteResponse]])
async def list_all_routes(
    origin: Optional[str] = None, 
    destination: Optional[str] = None, 
    db: AsyncSession = Depends(get_db)
):
    query = select(Route)
    if origin:
        query = query.where(Route.origin_city == origin)
    if destination:
        query = query.where(Route.destination_city == destination)
        
    result = await db.execute(query)
    routes = result.scalars().all()
    return BaseResponse(success=True, data=[RouteResponse.model_validate(r) for r in routes])
''')

with open(f"{base_dir}/routers/trips.py", "w") as f:
    f.write('''from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from database import get_db
from models.models import Trip, TripStatus, Bus, Route, Operator
from schemas.schemas import TripCreate, TripUpdate, TripResponse
from api.deps import get_current_user_payload

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.kafka_producer import KafkaProducerClient

router = APIRouter(prefix="/trips", tags=["trips"])

@router.post("/", response_model=BaseResponse[TripResponse])
async def create_trip(req: TripCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    # Verify relations
    op_res = await db.execute(select(Operator).where(Operator.id == req.operator_id))
    if not op_res.scalars().first(): raise HTTPException(status_code=404, detail="Operator not found")
    
    bus_res = await db.execute(select(Bus).where(Bus.id == req.bus_id, Bus.operator_id == req.operator_id))
    if not bus_res.scalars().first(): raise HTTPException(status_code=404, detail="Bus not found for operator")
        
    route_res = await db.execute(select(Route).where(Route.id == req.route_id, Route.operator_id == req.operator_id))
    if not route_res.scalars().first(): raise HTTPException(status_code=404, detail="Route not found for operator")

    trip = Trip(**req.model_dump())
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return BaseResponse(success=True, data=TripResponse.model_validate(trip), message="Trip scheduled")

@router.get("/{id}", response_model=BaseResponse[TripResponse])
async def get_trip(id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Trip).where(Trip.id == id))
    trip = result.scalars().first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return BaseResponse(success=True, data=TripResponse.model_validate(trip))

@router.get("/", response_model=BaseResponse[List[TripResponse]])
async def list_trips(
    operator_id: Optional[UUID] = None,
    date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Trip)
    if operator_id:
        query = query.where(Trip.operator_id == operator_id)
    if date:
        # Ideally filter by date range for the day, but matching exact here as placeholder
        query = query.where(Trip.departure_datetime >= date)
        
    result = await db.execute(query)
    trips = result.scalars().all()
    return BaseResponse(success=True, data=[TripResponse.model_validate(trip) for trip in trips])

@router.put("/{id}", response_model=BaseResponse[TripResponse])
async def update_trip(id: UUID, req: TripUpdate, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    result = await db.execute(select(Trip).where(Trip.id == id))
    trip = result.scalars().first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(trip, key, value)
        
    await db.commit()
    await db.refresh(trip)
    return BaseResponse(success=True, data=TripResponse.model_validate(trip), message="Trip updated")

@router.post("/{id}/cancel", response_model=BaseResponse)
async def cancel_trip(id: UUID, db: AsyncSession = Depends(get_db), payload: dict = Depends(get_current_user_payload)):
    result = await db.execute(select(Trip).where(Trip.id == id))
    trip = result.scalars().first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.status == TripStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Trip already cancelled")
        
    trip.status = TripStatus.CANCELLED
    await db.commit()

    # Publish Kafka events
    try:
        await KafkaProducerClient.publish("booking.cancelled", {
            "trip_id": str(trip.id),
            "operator_id": str(trip.operator_id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "reason": "Trip cancelled by operator"
        })
        
        await KafkaProducerClient.publish("audit.log", {
            "event": "trip.cancelled",
            "trip_id": str(trip.id),
            "user_id": payload.get("user_id"),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        print(f"Kafka publish failed: {e}")

    return BaseResponse(success=True, message=f"Trip {id} cancelled, refund initiated for related bookings.")
''')

with open(f"{base_dir}/main.py", "w") as f:
    f.write('''from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.operators import router as operators_router
from routers.buses_routes import router as buses_routes_router
from routers.trips import router as trips_router
from models.base import Base
from database import engine

app = FastAPI(title="Operator Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(operators_router)
app.include_router(buses_routes_router)
app.include_router(trips_router)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
async def root():
    return {"message": "Operator service is running"}
''')

print("Operator Service Scaffold Done")
