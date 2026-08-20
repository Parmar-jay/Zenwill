from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MissionResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    category: str
    difficulty: str
    duration_minutes: int
    xp_reward: int
    mind_strength_reward: int
    is_completed: bool
    is_ai_generated: bool
    date_assigned: Optional[datetime]
    date_completed: Optional[datetime]
    why_assigned: Optional[str]
    tags: List[str]

    class Config:
        from_attributes = True


class MissionCompleteRequest(BaseModel):
    duration_actual_minutes: Optional[int] = None
    feedback: Optional[str] = None


class MissionCompleteResponse(BaseModel):
    success: bool
    xp_earned: int
    mind_strength_gained: int
    new_mind_strength: int
    message: str
