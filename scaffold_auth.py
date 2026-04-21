import os

base_dir = "busgo/services/auth-service"
os.makedirs(f"{base_dir}/core", exist_ok=True)
os.makedirs(f"{base_dir}/api", exist_ok=True)
os.makedirs(f"{base_dir}/models", exist_ok=True)
os.makedirs(f"{base_dir}/schemas", exist_ok=True)
os.makedirs(f"{base_dir}/services", exist_ok=True)
os.makedirs(f"{base_dir}/routers", exist_ok=True)

with open(f"{base_dir}/requirements.txt", "a") as f:
    f.write("passlib[bcrypt]\nredis\n")

with open(f"{base_dir}/core/config.py", "w") as f:
    f.write('''import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey-please-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

settings = Settings()
''')

with open(f"{base_dir}/core/security.py", "w") as f:
    f.write('''from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
from passlib.context import CryptContext
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
''')

with open(f"{base_dir}/models/base.py", "w") as f:
    f.write('''from sqlalchemy.orm import declarative_base
Base = declarative_base()
''')

with open(f"{base_dir}/models/user.py", "w") as f:
    f.write('''import uuid
import sys
import os
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .base import Base

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import UserRole

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, nullable=True)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CUSTOMER)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class OTPRecord(Base):
    __tablename__ = "otp_records"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String, index=True, nullable=False)
    otp_code = Column(String(6), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)
    
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False)
    user = relationship("User")
''')

with open(f"{base_dir}/schemas/auth.py", "w") as f:
    f.write('''from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID

class RegisterRequest(BaseModel):
    phone: str
    full_name: str
    password: str
    email: Optional[EmailStr] = None

class VerifyOTPRequest(BaseModel):
    phone: str
    otp_code: str

class LoginRequest(BaseModel):
    phone: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class SendOTPRequest(BaseModel):
    phone: str

class GoogleLoginRequest(BaseModel):
    token: str

class UserResponse(BaseModel):
    id: UUID
    phone: str
    email: Optional[str]
    full_name: str
    role: str
    is_verified: bool
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserResponse
''')

with open(f"{base_dir}/services/otp.py", "w") as f:
    f.write('''import random
import redis.asyncio as aioredis
from core.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

class OTPService:
    @staticmethod
    def generate_otp() -> str:
        return str(random.randint(100000, 999999))

    @staticmethod
    async def store_otp(phone: str, otp: str):
        # Store in Redis with 5 minutes (300 seconds) TTL
        await redis_client.setex(f"otp:{phone}", 300, otp)
        
    @staticmethod
    async def verify_otp(phone: str, otp: str) -> bool:
        stored_otp = await redis_client.get(f"otp:{phone}")
        if stored_otp and stored_otp == otp:
            await redis_client.delete(f"otp:{phone}")
            return True
        return False

    @staticmethod
    def send_sms(phone: str, otp: str):
        # Mock SMS send
        print(f"[MOCK SMS] Sending OTP {otp} to {phone}")
''')

with open(f"{base_dir}/api/deps.py", "w") as f:
    f.write('''from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from core.config import settings
from database import get_db
from models.user import User
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.exceptions import UnauthorizedAccess
from shared.enums import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user

def require_role(required_role: UserRole):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role != required_role:
            raise HTTPException(status_code=403, detail="Operation not permitted")
        return current_user
    return role_checker
''')

with open(f"{base_dir}/routers/auth.py", "w") as f:
    f.write('''from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta, timezone
import uuid
import secrets

from database import get_db
from models.user import User, RefreshToken, OTPRecord
from schemas.auth import (
    RegisterRequest, VerifyOTPRequest, LoginRequest, 
    RefreshRequest, SendOTPRequest, GoogleLoginRequest, 
    TokenResponse, UserResponse
)
from core.security import get_password_hash, verify_password, create_access_token
from core.config import settings
from services.otp import OTPService
from api.deps import get_current_user

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.base_response import BaseResponse
from shared.kafka_producer import KafkaProducerClient

router = APIRouter(prefix="/auth", tags=["auth"])

async def create_refresh_token(db: AsyncSession, user_id: uuid.UUID) -> str:
    token = secrets.token_urlsafe(64)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db_token = RefreshToken(user_id=user_id, token=token, expires_at=expires_at)
    db.add(db_token)
    await db.commit()
    return token

@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.phone == req.phone))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Phone already registered")
        
    user = User(
        phone=req.phone,
        email=req.email,
        full_name=req.full_name,
        password_hash=get_password_hash(req.password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    otp = OTPService.generate_otp()
    await OTPService.store_otp(user.phone, otp)
    OTPService.send_sms(user.phone, otp)

    try:
        await KafkaProducerClient.publish("audit.log", {
            "event": "user.registered",
            "user_id": str(user.id),
            "phone": user.phone,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        print(f"Failed to publish to Kafka: {e}")

    return {"success": True, "message": "User registered. OTP sent."}

@router.post("/verify-otp")
async def verify_otp(req: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    is_valid = await OTPService.verify_otp(req.phone, req.otp_code)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    result = await db.execute(select(User).where(User.phone == req.phone))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_verified = True
    await db.commit()

    access_token = create_access_token({"user_id": str(user.id), "role": user.role.value, "phone": user.phone})
    refresh_token = await create_refresh_token(db, user.id)

    return {
        "success": True,
        "data": {"access_token": access_token, "refresh_token": refresh_token, "user": UserResponse.model_validate(user)},
        "message": "OTP verified successfully"
    }

@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.phone == req.phone))
    user = result.scalars().first()
    
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Phone not verified")

    access_token = create_access_token({"user_id": str(user.id), "role": user.role.value, "phone": user.phone})
    refresh_token = await create_refresh_token(db, user.id)

    return {
        "success": True,
        "data": {"access_token": access_token, "refresh_token": refresh_token, "user": UserResponse.model_validate(user)},
        "message": "Login successful"
    }

@router.post("/refresh")
async def refresh(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefreshToken).where(RefreshToken.token == req.refresh_token, RefreshToken.is_revoked == False))
    db_token = result.scalars().first()
    
    if not db_token or db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    db_token.is_revoked = True
    
    user_result = await db.execute(select(User).where(User.id == db_token.user_id))
    user = user_result.scalars().first()
    
    access_token = create_access_token({"user_id": str(user.id), "role": user.role.value, "phone": user.phone})
    new_refresh_token = await create_refresh_token(db, user.id)
    
    await db.commit()

    return {
        "success": True,
        "data": {"access_token": access_token, "refresh_token": new_refresh_token}
    }

@router.post("/logout")
async def logout(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefreshToken).where(RefreshToken.token == req.refresh_token))
    db_token = result.scalars().first()
    if db_token:
        db_token.is_revoked = True
        await db.commit()
    return {"success": True, "message": "Logged out successfully"}

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {"success": True, "data": UserResponse.model_validate(current_user)}

@router.post("/send-otp")
async def send_otp(req: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.phone == req.phone))
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="User not found")
        
    otp = OTPService.generate_otp()
    await OTPService.store_otp(req.phone, otp)
    OTPService.send_sms(req.phone, otp)
    
    return {"success": True, "message": "OTP sent successfully"}

@router.post("/google-login")
async def google_login(req: GoogleLoginRequest):
    raise HTTPException(status_code=501, detail="Google login not fully implemented yet")
''')

with open(f"{base_dir}/main.py", "w") as f:
    f.write('''from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.auth import router as auth_router
from models.base import Base
from database import engine

app = FastAPI(title="Auth Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth_router)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
async def root():
    return {"message": "Auth service is running"}
''')

print("Auth Scaffold Done")
