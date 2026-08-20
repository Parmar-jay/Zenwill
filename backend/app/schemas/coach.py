from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CoachMessageRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    emotional_context: Optional[str] = None   # e.g. "stressed", "urge", "motivated"


class CoachMessageResponse(BaseModel):
    reply: str
    session_id: str
    emotional_context_detected: Optional[str]
    suggested_actions: Optional[List[str]]
    created_at: datetime


class ChatHistoryMessage(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
