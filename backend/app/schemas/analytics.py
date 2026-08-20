from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class MindProfileResponse(BaseModel):
    id: str
    user_id: str
    mind_strength: int
    recovery_days: int
    current_flow: int
    longest_flow: int
    avg_sleep_quality: float
    avg_stress_level: float
    avg_mood: float
    avg_energy: float
    avg_focus: float
    avg_urge_intensity: float
    risk_score_today: int
    predicted_trigger_time: Optional[str]
    predicted_trigger_type: Optional[str]
    top_triggers: List[str]
    top_coping_strategies: List[str]
    high_risk_times: List[str]
    urge_free_days: int
    total_checkins: int
    total_missions_completed: int
    total_journal_entries: int
    total_emergency_sessions: int
    successful_emergency_sessions: int
    last_relapse_at: Optional[datetime]
    last_checkin_at: Optional[datetime]
    updated_at: datetime

    class Config:
        from_attributes = True


class WeeklyInsightResponse(BaseModel):
    week_start: str
    week_end: str
    mind_strength_start: int
    mind_strength_end: int
    mind_strength_change: int
    total_checkins: int
    total_missions: int
    missions_completed: int
    total_journal_entries: int
    avg_sleep_hours: float
    avg_stress: float
    avg_mood: float
    relapse_count: int
    urge_free_days: int
    top_trigger: Optional[str]
    best_coping_strategy: Optional[str]
    ai_summary: str
    ai_predictions: List[str]
    ai_recommendations: List[str]


class BehavioralEventRequest(BaseModel):
    event_type: str
    screen_name: Optional[str] = None
    feature_name: Optional[str] = None
    emotional_state: Optional[str] = None
    trigger_context: Optional[str] = None
    location_tag: Optional[str] = None
    outcome: Optional[str] = None
    intensity: Optional[float] = None
    impact_score: Optional[float] = None
    duration_seconds: Optional[float] = None
    device_info: Optional[str] = None
    app_version: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}


class EmergencyStartRequest(BaseModel):
    urge_intensity: int
    trigger_type: Optional[str] = None
    emotional_state: Optional[str] = None
    environment: Optional[str] = None


class EmergencyCompleteRequest(BaseModel):
    session_id: Optional[str] = None
    techniques_used: List[str] = []
    outcome: str = "resisted"           # resisted | relapsed | incomplete
    was_effective: Optional[bool] = True
    main_influence: Optional[str] = None
    trigger_reason: Optional[str] = None
    urge_intensity_before: Optional[int] = None
    urge_intensity_after: Optional[int] = None
    duration_minutes: Optional[int] = None
    most_helpful_technique: Optional[str] = None
    user_feedback: Optional[str] = None
    thought_note: Optional[str] = None


class EmergencyStartResponse(BaseModel):
    session_id: str
    ai_intervention_plan: str
    techniques_offered: List[dict]
    message: str
