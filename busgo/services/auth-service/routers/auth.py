from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, func
from datetime import datetime, timedelta, timezone
import uuid
import secrets
import httpx

from database import get_db
from models.user import User, RefreshToken, OTPRecord
from schemas.auth import (
    RegisterRequest, VerifyOTPRequest, LoginRequest,
    RefreshRequest, SendOTPRequest, GoogleLoginRequest,
    TokenResponse, UserResponse, UpdateProfileRequest, CreateAdminRequest
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

router = APIRouter(tags=["auth"])


def create_user_access_token(user: User) -> str:
    return create_access_token({
        "user_id": str(user.id),
        "role": user.role.value,
        "phone": user.phone,
        "email": user.email,
        "full_name": user.full_name,
    })


async def create_refresh_token(db: AsyncSession, user_id: uuid.UUID) -> str:
    token = secrets.token_urlsafe(64)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db_token = RefreshToken(user_id=user_id, token=token, expires_at=expires_at)
    db.add(db_token)
    await db.commit()
    return token

@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if not req.email:
        raise HTTPException(status_code=400, detail="Email is required")
        
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    user = User(
        phone=req.phone,
        email=req.email,
        full_name=req.full_name,
        password_hash=get_password_hash(req.password),
        is_verified=True,  # Auto-verify in dev (no OTP infrastructure yet)
        role=req.role
    )
        
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Skip OTP in dev mode
    # otp = OTPService.generate_otp()
    # await OTPService.store_otp(user.phone, otp)
    # OTPService.send_sms(user.phone, otp)

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

    access_token = create_user_access_token(user)
    refresh_token = await create_refresh_token(db, user.id)

    return {
        "success": True,
        "data": {"access_token": access_token, "refresh_token": refresh_token, "user": UserResponse.model_validate(user)},
        "message": "OTP verified successfully"
    }

@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(or_(User.phone == req.phone, User.email == req.phone)))
    user = result.scalars().first()
    
    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Phone not verified")

    access_token = create_user_access_token(user)
    refresh_token = await create_refresh_token(db, user.id)

    return {
        "success": True,
        "data": {"access_token": access_token, "refresh_token": refresh_token, "user": UserResponse.model_validate(user)},
        "message": "Login successful"
    }

@router.post("/token")
async def swagger_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """OAuth2-compatible token endpoint for Swagger UI authorization.
    Accepts form-encoded username (email/phone) + password."""
    result = await db.execute(select(User).where(or_(User.phone == form_data.username, User.email == form_data.username)))
    user = result.scalars().first()

    if not user or not user.password_hash or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Phone not verified")

    access_token = create_user_access_token(user)

    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh")
async def refresh(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefreshToken).where(RefreshToken.token == req.refresh_token, RefreshToken.is_revoked == False))
    db_token = result.scalars().first()
    
    if not db_token or db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    db_token.is_revoked = True
    
    user_result = await db.execute(select(User).where(User.id == db_token.user_id))
    user = user_result.scalars().first()
    
    access_token = create_user_access_token(user)
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

@router.put("/me")
async def update_profile(req: UpdateProfileRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if req.full_name is not None:
        current_user.full_name = req.full_name
    if req.email is not None:
        if req.email != current_user.email:
            # Check if email is already used by another user
            email_check = await db.execute(select(User).where(User.email == req.email))
            if email_check.scalars().first():
                raise HTTPException(status_code=400, detail="Email already in use")
            current_user.email = req.email
    if "phone" in req.model_fields_set:
        normalized_phone = (req.phone or "").strip() or None
        if normalized_phone != current_user.phone and normalized_phone is not None:
            phone_check = await db.execute(select(User).where(User.phone == normalized_phone, User.id != current_user.id))
            if phone_check.scalars().first():
                raise HTTPException(status_code=400, detail="Phone number is already in use")
        current_user.phone = normalized_phone

    await db.commit()
    await db.refresh(current_user)
    return {"success": True, "data": UserResponse.model_validate(current_user), "message": "Profile updated successfully"}

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
async def google_login(req: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    """Verify a Supabase Google session and exchange it for a BusGo session.

    BusGo remains the source of truth for local IDs and roles. Existing users
    are linked by their verified email, while new users may only choose a
    CUSTOMER or OPERATOR role.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="Google authentication is not configured")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user",
                headers={
                    "apikey": settings.SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {req.token}",
                },
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Unable to verify Google account")

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired Google session")

    identity = response.json()
    provider_subject = identity.get("id")
    email = (identity.get("email") or "").strip().lower()
    app_metadata = identity.get("app_metadata") or {}
    providers = set(app_metadata.get("providers") or [])
    if app_metadata.get("provider"):
        providers.add(app_metadata["provider"])
    if not provider_subject or not email or "google" not in providers:
        raise HTTPException(status_code=401, detail="A verified Google account is required")

    result = await db.execute(
        select(User).where(
            or_(
                User.provider_subject == provider_subject,
                func.lower(User.email) == email,
            )
        )
    )
    user = result.scalars().first()
    metadata = identity.get("user_metadata") or {}
    display_name = (
        metadata.get("full_name")
        or metadata.get("name")
        or email.split("@", 1)[0]
    ).strip()

    if user:
        if user.provider_subject and user.provider_subject != provider_subject:
            raise HTTPException(status_code=409, detail="Email is already linked to another Google account")
        user.provider_subject = provider_subject
        user.auth_provider = "google"
        user.is_verified = True
        if not user.full_name:
            user.full_name = display_name
    else:
        user = User(
            phone=None,
            email=email,
            full_name=display_name,
            password_hash=None,
            auth_provider="google",
            provider_subject=provider_subject,
            is_verified=True,
            # SQLAlchemy column defaults are applied during INSERT/flush, not
            # when the Python model is constructed. Set this explicitly so a
            # brand-new Google user is not mistaken for a disabled account.
            is_active=True,
            role=req.role,
        )
        db.add(user)

    # Only an explicit False represents an administratively disabled account.
    if user.is_active is False:
        raise HTTPException(status_code=403, detail="Account is disabled")

    await db.commit()
    await db.refresh(user)

    access_token = create_user_access_token(user)
    refresh_token = await create_refresh_token(db, user.id)

    try:
        await KafkaProducerClient.publish("audit.log", {
            "event": "user.google_login",
            "user_id": str(user.id),
            "email": user.email,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        print(f"Failed to publish to Kafka: {exc}")

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": UserResponse.model_validate(user),
        },
        "message": "Google login successful",
    }


@router.post("/reset-admin-password")
async def reset_admin_password(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Dev-only: reset password for any user by phone or email."""
    result = await db.execute(select(User).where(or_(User.phone == req.phone, User.email == req.phone)))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = get_password_hash(req.password)
    await db.commit()
    return {"success": True, "message": f"Password reset for {user.email or user.phone}"}


@router.post("/users/lookup")
async def lookup_users(body: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return id, full_name, email, phone for a list of user UUIDs. Available to any authenticated user."""
    import uuid as _uuid
    raw_ids = body.get("user_ids") or []
    parsed = []
    for uid in raw_ids:
        try:
            parsed.append(_uuid.UUID(str(uid)))
        except (ValueError, AttributeError):
            pass
    if not parsed:
        return {"success": True, "data": []}
    result = await db.execute(select(User).where(User.id.in_(parsed)))
    users = result.scalars().all()
    return {
        "success": True,
        "data": [
            {"id": str(u.id), "full_name": u.full_name, "email": u.email or "", "phone": u.phone}
            for u in users
        ],
    }


@router.post("/create-admin")
async def create_admin(req: CreateAdminRequest, db: AsyncSession = Depends(get_db)):
    """Dev-only endpoint to seed an admin account. Bypasses the ADMIN role restriction."""
    result = await db.execute(select(User).where(or_(User.email == req.email, User.phone == req.phone)))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="User with this email or phone already exists")

    from shared.enums import UserRole

    user = User(
        phone=req.phone,
        email=req.email,
        full_name=req.full_name,
        password_hash=get_password_hash(req.password),
        is_verified=True,
        role=UserRole.ADMIN,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"success": True, "message": "Admin user created", "data": UserResponse.model_validate(user)}
