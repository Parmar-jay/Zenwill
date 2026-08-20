import uuid
from datetime import datetime
from typing import Optional, List
from beanie import Document, Indexed
from pydantic import Field


class Mission(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Indexed(str)

    # ── Content ───────────────────────────────────────────────────────────────
    title: str
    description: Optional[str] = None
    category: str
    difficulty: str = "medium"
    duration_minutes: int = 10

    # ── Rewards ───────────────────────────────────────────────────────────────
    xp_reward: int = 10
    mind_strength_reward: int = 2

    # ── State ─────────────────────────────────────────────────────────────────
    is_completed: bool = False
    is_ai_generated: bool = True
    date_assigned: Optional[datetime] = None
    date_completed: Optional[datetime] = None

    # ── Context ───────────────────────────────────────────────────────────────
    why_assigned: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "missions"
