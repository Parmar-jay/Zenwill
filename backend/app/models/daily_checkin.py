import uuid
from datetime import datetime, date as date_type
from typing import Optional, List
from beanie import Document, Indexed
from pydantic import Field


class DailyCheckin(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Indexed(str)
    date: date_type

    # ── Screen 1: Mood ────────────────────────────────────────────────────────
    mood: str = "Neutral"  # e.g., Happy, Calm, Neutral, Sad, Angry, Anxious, Lonely, Overwhelmed, Frustrated
    mood_intensity: int = 5  # 1–10
    mood_factors: List[str] = Field(default_factory=list)

    # ── Screen 2: Energy ──────────────────────────────────────────────────────
    energy_score: int = 5  # 1–10
    energy_category: str = "Normal"  # Very Low, Low, Normal, Good, Excellent
    energy_factors: List[str] = Field(default_factory=list)

    # ── Screen 3: Stress ──────────────────────────────────────────────────────
    stress_score: int = 3  # 1–10
    stress_causes: List[str] = Field(default_factory=list)

    # ── Screen 4: Sleep ───────────────────────────────────────────────────────
    sleep_duration: float = 7.0  # Hours slept
    sleep_quality: int = 7  # 1–10
    rested_status: str = "Yes"  # Yes, No, Partially

    # ── Screen 5: Urges ───────────────────────────────────────────────────────
    urge_intensity: int = 0  # 0–10
    primary_triggers: List[str] = Field(default_factory=list)
    action_taken: str = "No"  # No, Almost, Yes
    relapse_occurred: bool = False
    pornography_involved: Optional[bool] = None
    session_duration: Optional[str] = None  # e.g., "< 15 mins", "15-30 mins", etc.
    post_relapse_emotions: List[str] = Field(default_factory=list)

    # ── Screen 6: Focus ───────────────────────────────────────────────────────
    focus_score: int = 5  # 1–10
    focus_factors: List[str] = Field(default_factory=list)

    # ── Screen 7: Reflection ──────────────────────────────────────────────────
    reflection_question: Optional[str] = None
    reflection_response: Optional[str] = None

    # ── Screen 8 & AI Integration ─────────────────────────────────────────────
    ai_summary: Optional[dict] = None
    ai_risk_score: Optional[int] = None
    ai_insight: Optional[str] = None
    ai_mission_ids: List[str] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    # ── Legacy / Compatibility Properties ─────────────────────────────────────
    @property
    def sleep_hours(self) -> float:
        return self.sleep_duration

    @property
    def stress(self) -> int:
        return self.stress_score

    @property
    def focus(self) -> int:
        return self.focus_score

    @property
    def energy(self) -> int:
        return self.energy_score

    @property
    def relapse_triggers(self) -> List[str]:
        return self.primary_triggers

    class Settings:
        name = "daily_checkins"
