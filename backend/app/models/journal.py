import uuid
from datetime import datetime
from typing import Optional, List
# pyrefly: ignore [missing-import]
from beanie import Document, Indexed
from pydantic import Field


class JournalEntry(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Indexed(str)
    author_name: Optional[str] = "Anonymous Member"

    # ── Content ───────────────────────────────────────────────────────────────
    title: Optional[str] = None
    content: str
    prompt_used: Optional[str] = None

    # ── Emotional Context ─────────────────────────────────────────────────────
    mood_tag: Optional[str] = None
    energy_tag: Optional[str] = None
    emotional_tags: List[str] = Field(default_factory=list)

    # ── AI Analysis ───────────────────────────────────────────────────────────
    ai_themes: List[str] = Field(default_factory=list)
    ai_insight: Optional[str] = None
    ai_sentiment_score: Optional[float] = None

    # ── Meta ──────────────────────────────────────────────────────────────────
    is_private: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "journal_entries"
