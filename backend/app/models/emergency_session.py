import uuid
from datetime import datetime
from typing import Optional, List
# pyrefly: ignore [missing-import]
from beanie import Document, Indexed
from pydantic import Field


class EmergencySession(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # pyrefly: ignore [invalid-annotation]
    user_id: Indexed(str)

    # ── Intake ────────────────────────────────────────────────────────────────
    urge_intensity: int
    trigger_type: Optional[str] = None
    emotional_state: Optional[str] = None
    environment: Optional[str] = None

    # ── Intervention ──────────────────────────────────────────────────────────
    techniques_offered: List[str] = Field(default_factory=list)
    techniques_used: List[str] = Field(default_factory=list)
    ai_intervention_plan: Optional[str] = None
    duration_minutes: Optional[int] = None

    # ── Outcome ───────────────────────────────────────────────────────────────
    outcome: Optional[str] = None
    urge_intensity_after: Optional[int] = None
    user_feedback: Optional[str] = None
    most_helpful_technique: Optional[str] = None

    # ── Urge Surfing Feedback ─────────────────────────────────────────────────
    was_effective: Optional[bool] = None          # Did urge surfing help?
    trigger_reason: Optional[str] = None          # What triggered the urge
    main_influence: Optional[str] = None          # What influenced user the most
    urge_source: Optional[str] = None             # Where was the user
    relapse_risk_after: Optional[str] = None      # low / medium / high
    urge_surfing_completed: bool = False           # Was the urge surfing session completed

    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    class Settings:
        name = "emergency_sessions"
