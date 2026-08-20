import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
# pyrefly: ignore [missing-import]
from beanie import Document, Indexed
from pydantic import Field


class Onboarding(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # pyrefly: ignore [invalid-annotation]
    user_id: Indexed(str, unique=True)

    # Identity
    first_name: Optional[str] = None
    age_group: Optional[str] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    daily_schedule: Optional[str] = None
    relationship_status: Optional[str] = None

    # Mental State
    self_control: Optional[str] = None
    motivation_to_change: Optional[int] = 5
    confidence_in_quitting: Optional[int] = 5
    stress_level: Optional[int] = 5
    anxiety_level: Optional[int] = 5
    mood: Optional[str] = None
    energy: Optional[str] = None
    sleep_quality: Optional[str] = None
    focus_level: Optional[str] = None
    emotional_control: Optional[str] = None
    urge_frequency: Optional[str] = None
    screen_time: Optional[str] = None

    # Purpose
    improvement_reasons: List[str] = Field(default_factory=list)
    primary_outcome: Optional[str] = None
    personal_statement: Optional[str] = None

    # Triggers & Habit Loop
    urge_times: List[str] = Field(default_factory=list)
    urge_locations: List[str] = Field(default_factory=list)
    emotional_triggers: List[str] = Field(default_factory=list)
    first_warning_sign: Optional[str] = None
    urge_duration: Optional[str] = None
    typical_responses: List[str] = Field(default_factory=list)
    emotional_aftermath: List[str] = Field(default_factory=list)
    primary_device: Optional[str] = None
    online_platforms: List[str] = Field(default_factory=list)

    # Permissions
    perm_notifications: bool = False

    # Oath & Signature
    signature: Optional[str] = None
    is_pledge_signed: bool = False

    # Raw Payload Snapshot
    raw_onboarding_data: Dict[str, Any] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "onboardings"
