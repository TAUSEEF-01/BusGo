from typing import Any, Generic, TypeVar, Optional, List
from pydantic import BaseModel

T = TypeVar('T')

class BaseResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    message: str = ''
    errors: Optional[List[str]] = None
