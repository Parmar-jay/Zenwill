import uuid
from datetime import datetime
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class RecommendationTaskCompletion(Document):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Indexed(str)
    task_id: str
    action_type: str  # 'checkin', 'meditation', 'journal', 'rescue', 'chat', 'purpose', 'missions', 'trigger_intel'
    title: str
    date_str: Indexed(str)  # YYYY-MM-DD
    time_window: str  # 'Morning', 'Afternoon', 'Evening'
    xp_reward: int = 15
    completed_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "recommendation_tasks"
