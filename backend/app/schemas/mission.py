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


class MissionCompleteCategoryRequest(BaseModel):
    category: str
    duration_actual_minutes: Optional[int] = None
    feedback: Optional[str] = None


class MissionSyncTasksRequest(BaseModel):
    tasks: dict


class MissionCompleteResponse(BaseModel):
    success: bool
    xp_earned: int
    mind_strength_gained: int
    new_mind_strength: int
    message: str
    missions: Optional[List[MissionResponse]] = None


class DailyTasksStatusResponse(BaseModel):
    date: str
    tasks: dict
    completed_count: int
    total_points: int
    all_completed: bool

