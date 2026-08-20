from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import uuid
from datetime import datetime


class OnboardingDataSubmit(BaseModel):
    """Full onboarding profile from the React Native store."""
    # Identity
    firstName: Optional[str] = None
    ageGroup: Optional[str] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    dailySchedule: Optional[str] = None
    relationshipStatus: Optional[str] = None

    # Mental State
    selfControl: Optional[str] = None
    motivationToChange: Optional[int] = None
    confidenceInQuitting: Optional[int] = None
    stressLevel: Optional[int] = None
    anxietyLevel: Optional[int] = None
    mood: Optional[str] = None
    energy: Optional[str] = None
    sleepQuality: Optional[str] = None
    focusLevel: Optional[str] = None
    emotionalControl: Optional[str] = None
    urgeFrequency: Optional[str] = None
    screenTime: Optional[str] = None

    # Purpose
    improvementReasons: Optional[List[str]] = []
    primaryOutcome: Optional[str] = None
    personalStatement: Optional[str] = None

    # Triggers
    urgeTimes: Optional[List[str]] = []
    urgeLocations: Optional[List[str]] = []
    emotionalTriggers: Optional[List[str]] = []
    firstWarningSign: Optional[str] = None
    urgeDuration: Optional[str] = None
    typicalResponses: Optional[List[str]] = []
    emotionalAftermath: Optional[List[str]] = []
    primaryDevice: Optional[str] = None
    onlinePlatforms: Optional[List[str]] = []

    # Permissions
    permNotifications: Optional[bool] = False

    # Oath & Signature
    signature: Optional[str] = None
    isPledgeSigned: Optional[bool] = False


class UserProfileResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    is_onboarded: bool
    onboarding_step: int
    created_at: datetime
    streak: int = 0
    max_streak: int = 0
    total_points: int = 0
    mind_strength: int = 50
    last_checkin_date: Optional[str] = None
    ai_mindset_score: int = 500
    ai_mindset_analysis: Optional[str] = None
    journals_count: int = 0
    recent_journals: List[Dict[str, Any]] = []
    meditations_count: int = 0
    afternoon_meditation_done: bool = False
    latest_checkin_summary: Optional[Dict[str, Any]] = None
    total_urges_count: int = 0
    today_urges_count: int = 0
    daily_urge_counts: List[Dict[str, Any]] = []

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    onboarding_step: Optional[int] = None
    streak: Optional[int] = None
    max_streak: Optional[int] = None
    mind_strength: Optional[int] = None
    total_points: Optional[int] = None
    last_checkin_date: Optional[str] = None

