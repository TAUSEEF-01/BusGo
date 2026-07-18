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
    email: EmailStr
    role: Optional[UserRole] = UserRole.CUSTOMER

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v == UserRole.ADMIN:
            raise ValueError("Cannot register as ADMIN")
        return v

class CreateAdminRequest(BaseModel):
    phone: str
    full_name: str
    password: str
    email: EmailStr


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
    role: UserRole = UserRole.CUSTOMER

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v == UserRole.ADMIN:
            raise ValueError("Cannot register as ADMIN")
        return v

class UserResponse(BaseModel):
    id: UUID
    phone: Optional[str]
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

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, value):
        if value is None:
            return value
        digits = "".join(character for character in value if character.isdigit())
        if digits.startswith("880") and len(digits) == 13:
            digits = "0" + digits[3:]
        if len(digits) != 11 or not digits.startswith("01"):
            raise ValueError("Enter a valid 11-digit Bangladeshi phone number")
        return digits
