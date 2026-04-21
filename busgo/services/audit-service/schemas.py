from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Any


class AuditLogResponse(BaseModel):
    id: UUID
    event_type: str
    entity_type: str
    entity_id: UUID
    user_id: Optional[UUID] = None
    operator_id: Optional[UUID] = None
    payload: Any
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True
