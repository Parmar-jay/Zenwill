import uuid
from datetime import datetime
from typing import Optional, List
# pyrefly: ignore [missing-import]
from beanie import Document, Indexed
from pydantic import Field


class RelapseAutopsy(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # pyrefly: ignore [invalid-annotation]
    user_id: Indexed(str)
    # pyrefly: ignore [invalid-annotation]
    date_str: Indexed(str)  # YYYY-MM-DD
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # ── Forensic Data ─────────────────────────────────────────────────────────
    streak_before_relapse: int = 0
    first_compromise_domino: str  # e.g. 'phone_in_bed', 'doomscrolling', 'work_stress_isolation', 'suggestive_peeking'
    first_compromise_title: str
    emotional_precursor: str       # e.g. 'stress', 'fatigue', 'loneliness', 'boredom', 'anxiety'
    physical_environment: str      # e.g. 'Bedroom Bedside', 'Bathroom', 'Couch / Living Room', 'Work Desk'
    device_involved: str           # e.g. 'phone', 'laptop', 'tablet', 'desktop'
    approximate_time_window: Optional[str] = None

    # ── Psychological Recovery & Rule ─────────────────────────────────────────
    retained_clean_days: int = 0
    retained_percentage: float = 85.0
    generated_golden_rule: str
    rule_category: str = "Environmental"
    pledge_signed: bool = True
    user_reflection_note: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "relapse_autopsies"
