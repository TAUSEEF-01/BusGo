import sys
import os

sys.path.append(os.path.abspath('busgo/services/auth-service'))
sys.path.append(os.path.abspath('busgo'))

from pydantic import BaseModel
from shared.enums import UserRole

class UserFake:
    role = UserRole.OPERATOR

class UserResponseStr(BaseModel):
    role: str
    class Config:
        from_attributes = True

class UserResponseEnum(BaseModel):
    role: UserRole
    class Config:
        from_attributes = True

user = UserFake()

res_str = UserResponseStr.model_validate(user)
print("String role output:", res_str.model_dump())

res_enum = UserResponseEnum.model_validate(user)
print("Enum role output:", res_enum.model_dump())
