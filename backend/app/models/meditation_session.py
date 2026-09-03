from datetime import datetime
from typing import Optional, List, Dict, Any
# pyrefly: ignore [missing-import]
from beanie import Document, Indexed
from pydantic import Field


class MeditationSession(Document):
    user_id: Indexed(str)
    user_email: Optional[str] = None
    user_name: Optional[str] = "Operative"
    technique_id: Indexed(str)
    technique_title: str
    category: Optional[str] = "Pranayama"
    duration_seconds: int = 0
    duration_minutes: float = 0.0
    rounds_completed: int = 1
    completed: bool = True
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime = Field(default_factory=datetime.utcnow)
    emotional_state: Optional[str] = "calm"
    rating: Optional[int] = 5
    steps_performed: List[str] = []
    hour_of_day: Optional[int] = None
    day_of_week: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = {}
    created_at: Indexed(datetime) = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "meditation_sessions"
        indexes = [
            [("user_id", 1), ("created_at", -1)],
            [("user_id", 1), ("technique_id", 1)],
            [("created_at", -1)],
        ]
