from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class DailyMindsetScore(BaseModel):
    user_id: str
    date_str: str  # YYYY-MM-DD
    score: int = Field(default=85, ge=0, le=100)
    status_title: str = "Ojas Transmutation Active"
    summary: str = ""
    transmutation_tip: str = ""
    checkin_score: int = 30
    journal_score: int = 20
    meditation_urge_score: int = 35
    details_json: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
