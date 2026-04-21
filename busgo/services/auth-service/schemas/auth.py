from pydantic import BaseModel, EmailStr
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
