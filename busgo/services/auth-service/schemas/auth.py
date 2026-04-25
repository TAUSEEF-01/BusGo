from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from uuid import UUID
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import UserRole

class RegisterRequest(BaseModel):
    phone: str
    full_name: str
    password: str
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = UserRole.CUSTOMER

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v == UserRole.ADMIN:
            raise ValueError("Cannot register as ADMIN")
        return v

class VerifyOTPRequest(BaseModel):
    phone: str
    otp_code: str

class LoginRequest(BaseModel):
    phone: str
    password: str
    expected_role: Optional[UserRole] = None

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
    role: UserRole
    is_verified: bool
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserResponse
