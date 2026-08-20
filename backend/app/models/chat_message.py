import uuid
from datetime import datetime
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class ChatMessage(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Indexed(str)

    role: str
    content: str
    emotional_context: Optional[str] = None
    session_id: Optional[str] = None

    created_at: Indexed(datetime) = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "chat_messages"
