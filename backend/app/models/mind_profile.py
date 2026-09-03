import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
# pyrefly: ignore [missing-import]
from beanie import Document, Indexed
from pydantic import Field, field_validator


class MindProfile(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # pyrefly: ignore [invalid-annotation]
    user_id: Indexed(str, unique=True)

    # ── Core Metrics ───────────────────────────────────────────────────────────
    mind_strength: Union[int, float] = 50.0
    recovery_days: int = 0
    current_flow: int = 0
    longest_flow: int = 0

    @field_validator("mind_strength", mode="before")
    @classmethod
    def validate_mind_strength(cls, v):
        if v is None:
            return 50.0
        try:
            return round(float(v), 1)
        except (ValueError, TypeError):
            return 50.0

    # ── Behavioral Averages ────────────────────────────────────────────────────
    avg_sleep_quality: float = 5.0
    avg_stress_level: float = 5.0
    avg_mood: float = 5.0
    avg_energy: float = 5.0
    avg_focus: float = 5.0
    avg_urge_intensity: float = 5.0
    urge_free_days: int = 0
    total_checkins: int = 0
    total_missions_completed: int = 0
    total_journal_entries: int = 0
    total_emergency_sessions: int = 0
    successful_emergency_sessions: int = 0

    # ── Predictions ────────────────────────────────────────────────────────────
    risk_score_today: int = 30
    predicted_trigger_time: Optional[str] = None
    predicted_trigger_type: Optional[str] = None

    # ── Intelligence & Activity Tracking ─────────────────────────────────────
    top_triggers: List[str] = Field(default_factory=list)
    top_coping_strategies: List[str] = Field(default_factory=list)
    high_risk_times: List[str] = Field(default_factory=list)
    onboarding_data: Dict[str, Any] = Field(default_factory=dict)
    weekly_pattern: Dict[str, Any] = Field(default_factory=dict)
    activity_log: List[Dict[str, Any]] = Field(default_factory=list)
    completed_missions_history: List[Dict[str, Any]] = Field(default_factory=list)
    mind_improvement_timeline: List[Dict[str, Any]] = Field(default_factory=list)

    # ── Timestamps ────────────────────────────────────────────────────────────
    last_relapse_at: Optional[datetime] = None
    last_checkin_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "mind_profiles"
