import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
# pyrefly: ignore [missing-import]
from beanie import Document, Indexed
from pydantic import Field


class CellMember(Document):
    user_id: str
    name: str
    streak: int = 0
    rank_tier: str = "Bronze I"
    badge: str = "🥉"
    last_checkin_date: Optional[str] = None
    today_checked_in: bool = False
    is_leader: bool = False
    is_online: bool = False
    joined_at: datetime = Field(default_factory=datetime.utcnow)


class SpartanCell(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # pyrefly: ignore [invalid-annotation]
    name: Indexed(str, unique=True)
    motto: str = "We hold the line together."
    # pyrefly: ignore [invalid-annotation]
    join_code: Indexed(str, unique=True)  # 6-character unique alphanumeric code
    # pyrefly: ignore [invalid-annotation]
    leader_id: Indexed(str)
    leader_name: str = "Commander"
    
    # Members (Leader + up to 19 warriors = 20 max)
    member_ids: List[str] = Field(default_factory=list)
    members: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Collective Stats
    total_streak: int = 0
    collective_xp: int = 0
    shield_status: str = "cracked"  # "gold" | "active" | "cracked"
    gold_shield_streak: int = 0
    max_members: int = 20
    is_public: bool = True
    
    # Activity Telemetry
    last_activity_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "spartan_cells"
