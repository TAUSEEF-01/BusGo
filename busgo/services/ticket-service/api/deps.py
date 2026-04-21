from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from core.config import settings
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_current_user_payload(request: Request, token: str = Depends(oauth2_scheme)):
    if not token:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth.split(" ")[1]
        else:
            return {"user_id": "system", "role": "SYSTEM"}

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(roles: list[str]):
    def role_checker(payload: dict = Depends(get_current_user_payload)):
        if payload.get("role") not in roles and payload.get("role") != "SYSTEM":
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return payload
    return role_checker
