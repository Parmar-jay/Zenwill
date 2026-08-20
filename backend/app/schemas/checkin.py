from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime


class DailyCheckinRequest(BaseModel):
    date: Optional[date] = None

    # Screen 1: Mood
    mood: str = Field(default="Neutral", description="Selected emotion e.g. Happy, Calm, Sad...")
    mood_intensity: int = Field(default=5, ge=1, le=10)
    mood_factors: Optional[List[str]] = Field(default_factory=list)

    # Screen 2: Energy
    energy_score: int = Field(default=5, ge=1, le=10)
    energy_category: str = Field(default="Normal")
    energy_factors: Optional[List[str]] = Field(default_factory=list)

    # Screen 3: Stress
    stress_score: int = Field(default=3, ge=1, le=10)
    stress_causes: Optional[List[str]] = Field(default_factory=list)

    # Screen 4: Sleep
    sleep_duration: float = Field(default=7.0, ge=0.0, le=24.0)
    sleep_quality: int = Field(default=7, ge=1, le=10)
    rested_status: str = Field(default="Yes")

    # Screen 5: Urges
    urge_intensity: int = Field(default=0, ge=0, le=10)
    primary_triggers: Optional[List[str]] = Field(default_factory=list)
    action_taken: str = Field(default="No")  # No, Almost, Yes
    relapse_occurred: bool = False
    pornography_involved: Optional[bool] = None
    session_duration: Optional[str] = None
    post_relapse_emotions: Optional[List[str]] = Field(default_factory=list)

    # Screen 6: Focus
    focus_score: int = Field(default=5, ge=1, le=10)
    focus_factors: Optional[List[str]] = Field(default_factory=list)

    # Screen 7: Reflection
    reflection_question: Optional[str] = None
    reflection_response: Optional[str] = None


class DailyCheckinResponse(BaseModel):
    id: str
    date: date
    mood: str
    mood_intensity: int
    mood_factors: List[str]
    energy_score: int
    energy_category: str
    energy_factors: List[str]
    stress_score: int
    stress_causes: List[str]
    sleep_duration: float
    sleep_quality: int
    rested_status: str
    urge_intensity: int
    primary_triggers: List[str]
    action_taken: str
    relapse_occurred: bool
    pornography_involved: Optional[bool]
    session_duration: Optional[str]
    post_relapse_emotions: List[str]
    focus_score: int
    focus_factors: List[str]
    reflection_question: Optional[str]
    reflection_response: Optional[str]
    ai_summary: Optional[Dict[str, Any]]
    ai_risk_score: Optional[int]
    ai_insight: Optional[str]
    ai_mission_ids: List[str]
    created_at: datetime

    class Config:
        from_attributes = True

