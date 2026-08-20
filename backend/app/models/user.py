import uuid
from datetime import datetime
from typing import Optional
# pyrefly: ignore [missing-import]
from beanie import Document, Indexed
from pydantic import Field


class User(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # pyrefly: ignore [invalid-annotation]
    email: Indexed(str, unique=True)
    hashed_password: str = ""
    name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_onboarded: bool = False
    onboarding_step: int = 0
    is_active: bool = True
    email_verified: bool = False
    refresh_token: Optional[str] = None

    # Streak & Gamification Stats
    streak: int = 0
    max_streak: int = 0
    last_active_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    last_checkin_date: Optional[str] = None
    total_points: int = 0
    mind_strength: int = 50

    # OTP Auth
    otp_code: Optional[str] = None
    otp_expires_at: Optional[datetime] = None

    # Scheduled Account Deletion (7-Day Grace Period)
    is_scheduled_for_deletion: bool = False
    deletion_scheduled_at: Optional[datetime] = None
    deletion_reason: Optional[str] = None

    class Settings:
        name = "users"

