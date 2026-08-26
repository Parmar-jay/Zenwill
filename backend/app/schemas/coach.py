from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CoachMessageRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    emotional_context: Optional[str] = None   # e.g. "stressed", "urge", "motivated"
    local_time: Optional[str] = None          # e.g. "05:24 PM"
    local_date: Optional[str] = None          # e.g. "Wednesday, August 26, 2026"
    timezone: Optional[str] = None            # e.g. "Asia/Kolkata"
    time_of_day: Optional[str] = None         # e.g. "Morning", "Afternoon", "Evening", "Night"


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
