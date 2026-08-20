from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class JournalEntryCreate(BaseModel):
    title: Optional[str] = None
    content: str
    prompt_used: Optional[str] = None
    mood_tag: Optional[str] = None
    energy_tag: Optional[str] = None
    emotional_tags: Optional[List[str]] = []
    is_private: Optional[bool] = False


class JournalEntryResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    author_name: Optional[str] = "Anonymous Member"
    title: Optional[str] = None
    content: str
    prompt_used: Optional[str] = None
    mood_tag: Optional[str] = None
    emotional_tags: List[str] = []
    ai_themes: List[str] = []
    ai_insight: Optional[str] = None
    is_private: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class JournalEntryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    mood_tag: Optional[str] = None
    emotional_tags: Optional[List[str]] = None
    is_private: Optional[bool] = None
