from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field


class CommunityMessage(Document):
    user_id: Optional[str] = "user_guest"
    author_name: str = "Operative"
    author_rank: str = "Silver I"
    author_badge: str = "🥈"
    author_streak: int = 0
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    likes_count: int = 0

    class Settings:
        name = "community_messages"
