import uuid
from datetime import datetime
from typing import Optional
# pyrefly: ignore [missing-import]
from beanie import Document, Indexed
from pydantic import Field, BaseModel


class DirectMessage(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # pyrefly: ignore [invalid-annotation]
    sender_id: Indexed(str)
    sender_name: str = "Operative"
    sender_username: Optional[str] = None
    # pyrefly: ignore [invalid-annotation]
    receiver_id: Indexed(str)
    receiver_name: str = "Operative"
    receiver_username: Optional[str] = None
    content: str
    message_type: str = "text"  # "text" or "audio"
    audio_duration: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "direct_messages"


class DirectMessageSendRequest(BaseModel):
    receiver_id: Optional[str] = None
    receiver_username: Optional[str] = None
    content: str
    message_type: Optional[str] = "text"
    audio_duration: Optional[str] = None


class DirectMessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    sender_username: Optional[str] = None
    receiver_id: str
    receiver_name: str
    receiver_username: Optional[str] = None
    content: str
    message_type: str = "text"
    audio_duration: Optional[str] = None
    is_read: bool = False
    created_at: str


class ConversationSummary(BaseModel):
    other_user_id: str
    other_user_name: str
    other_user_username: Optional[str] = None
    last_message: str
    last_message_at: str
    unread_count: int = 0


class DirectMessageUnreadResponse(BaseModel):
    unread_count: int = 0
    latest_sender_name: Optional[str] = None
    latest_sender_id: Optional[str] = None
    latest_message: Optional[str] = None
    latest_created_at: Optional[str] = None
