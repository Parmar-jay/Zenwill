import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
# pyrefly: ignore [missing-import]
from beanie import Document, Indexed
from pydantic import Field


class BattleSession(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # pyrefly: ignore [invalid-annotation]
    initiator_id: Indexed(str)
    initiator_name: str = "Brother Warrior"
    initiator_streak: int = 0
    initiator_location: str = "Global Sanctum"
    
    # 90-Second Countdown & Room State
    duration_seconds: int = 90
    status: str = "active"  # "active" | "completed" | "expired"
    
    # Participants (Brothers who answered the battle horn)
    participant_ids: List[str] = Field(default_factory=list)
    participants: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Real-Time Runes / Reactions
    reactions: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Gamification
    honor_points_awarded: int = 25
    
    # Timestamps
    started_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    class Settings:
        name = "battle_sessions"
