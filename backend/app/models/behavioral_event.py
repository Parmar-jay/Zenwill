import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from beanie import Document, Indexed
from pydantic import Field


class BehavioralEvent(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Indexed(str)

    # ── User Context Snapshot ──────────────────────────────────────────────────
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    user_streak: Optional[int] = None
    mind_strength_at_event: Optional[int] = None

    # ── Event Classification & Target ──────────────────────────────────────────
    event_type: Indexed(str)
    screen_name: Optional[str] = None
    feature_name: Optional[str] = None

    # ── Behavioral & Emotional Context ─────────────────────────────────────────
    emotional_state: Optional[str] = None
    trigger_context: Optional[str] = None
    location_tag: Optional[str] = None
    hour_of_day: Optional[int] = None
    day_of_week: Optional[int] = None
    outcome: Optional[str] = None           # e.g., 'resisted', 'relapsed', 'completed', 'skipped'
    intensity: Optional[float] = None       # e.g. urge intensity (1-10) or stress score
    impact_score: Optional[float] = None    # e.g. +5 mind growth or -8 setback
    duration_seconds: Optional[float] = None

    # ── Telemetry & Deep Metadata ─────────────────────────────────────────────
    device_info: Optional[str] = None
    app_version: Optional[str] = None
    event_metadata: Dict[str, Any] = Field(default_factory=dict)

    created_at: Indexed(datetime) = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "behavioral_events"
