from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.models.user import User
from app.models.meditation_session import MeditationSession
from app.models.behavioral_event import BehavioralEvent
from app.middleware.auth_middleware import get_current_user
from app.services.mind_profile_service import get_or_create_mind_profile
from app.services.recommendation_service import complete_user_recommendation_task

router = APIRouter(prefix="/meditation", tags=["Meditation & Breathwork"])


class MeditationSessionRequest(BaseModel):
    technique_id: str
    technique_title: str
    category: Optional[str] = "Pranayama"
    duration_seconds: int = 0
    duration_minutes: Optional[float] = None
    rounds_completed: int = 1
    completed: bool = True
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    emotional_state: Optional[str] = "calm"
    rating: Optional[int] = 5
    steps_performed: Optional[List[str]] = []
    metadata: Optional[Dict[str, Any]] = {}


@router.post("/sessions", status_code=201)
async def log_meditation_session(
    payload: MeditationSessionRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Persists complete meditation session telemetry to MongoDB,
    records behavioral events, awards Mind Strength points, and completes daily mission.
    """
    now = datetime.utcnow()
    user_id = str(current_user.id)

    started_at = payload.started_at or now - timedelta(seconds=payload.duration_seconds or 300)
    completed_at = payload.completed_at or now
    duration_secs = max(payload.duration_seconds, 1)
    duration_mins = payload.duration_minutes if payload.duration_minutes is not None else round(duration_secs / 60.0, 1)

    profile = await get_or_create_mind_profile(current_user)

    # 1. Create and persist MeditationSession document
    session = MeditationSession(
        user_id=user_id,
        user_email=current_user.email,
        user_name=current_user.name or "Operative",
        technique_id=payload.technique_id,
        technique_title=payload.technique_title,
        category=payload.category,
        duration_seconds=duration_secs,
        duration_minutes=duration_mins,
        rounds_completed=max(payload.rounds_completed, 1),
        completed=payload.completed,
        started_at=started_at,
        completed_at=completed_at,
        emotional_state=payload.emotional_state or "calm",
        rating=payload.rating or 5,
        steps_performed=payload.steps_performed or [],
        hour_of_day=now.hour,
        day_of_week=now.weekday(),
        metadata=payload.metadata or {},
        created_at=now,
    )
    await session.insert()

    # 2. Also log as BehavioralEvent for analytics & progress intelligence
    event = BehavioralEvent(
        user_id=user_id,
        user_email=current_user.email,
        user_name=current_user.name or "Operative",
        user_streak=current_user.streak,
        mind_strength_at_event=profile.mind_strength,
        event_type="meditation_session",
        screen_name="meditation_screen",
        feature_name=payload.technique_title,
        emotional_state=payload.emotional_state or "calm",
        outcome="completed" if payload.completed else "partial",
        duration_seconds=duration_secs,
        hour_of_day=now.hour,
        day_of_week=now.weekday(),
        event_metadata={
            "session_id": str(session.id),
            "technique_id": payload.technique_id,
            "technique_title": payload.technique_title,
            "category": payload.category,
            "rounds_completed": payload.rounds_completed,
            "duration_minutes": duration_mins,
            "steps_count": len(payload.steps_performed or []),
        },
        created_at=now,
    )
    await event.insert()

    # 3. Award Mind Strength & log activity to Mind Profile
    profile.mind_strength = min(100.0, (profile.mind_strength or 50.0) + 1.5)
    activity_entry = {
        "timestamp": now.isoformat(),
        "activity_type": "meditation_session",
        "feature_name": payload.technique_title,
        "details": f"Completed {duration_mins}m ({payload.rounds_completed} rounds)",
        "metadata": {
            "session_id": str(session.id),
            "technique_id": payload.technique_id,
            "category": payload.category,
        },
    }
    history = list(profile.activity_log or [])
    history.append(activity_entry)
    profile.activity_log = history[-100:]
    await profile.save()

    # 4. Auto-complete recommendation task if active
    try:
        await complete_user_recommendation_task(
            current_user,
            task_id="rec_meditation",
            action_type="meditation",
            title=f"Meditation: {payload.technique_title}",
        )
    except Exception:
        pass

    return {
        "success": True,
        "session_id": str(session.id),
        "technique_title": payload.technique_title,
        "duration_minutes": duration_mins,
        "rounds_completed": session.rounds_completed,
        "mind_strength_awarded": 1.5,
        "created_at": now.isoformat(),
    }


@router.get("/history")
async def get_meditation_history(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """Returns recent meditation sessions for the current user."""
    user_id = str(current_user.id)
    user_email = current_user.email
    query = {"$or": [{"user_id": user_id}, {"user_email": user_email}]} if user_email else {"user_id": user_id}
    sessions = (
        await MeditationSession.find(query)
        .sort("-created_at")
        .limit(limit)
        .to_list()
    )
    return sessions


@router.get("/stats")
async def get_meditation_stats(
    current_user: User = Depends(get_current_user),
):
    """
    Computes lifetime and recent meditation statistics for the user:
    total sessions, total minutes, favorite practice, and streak.
    """
    user_id = str(current_user.id)
    user_email = current_user.email
    query = {"$or": [{"user_id": user_id}, {"user_email": user_email}]} if user_email else {"user_id": user_id}
    sessions = await MeditationSession.find(query).to_list()

    total_sessions = len(sessions)
    total_seconds = sum(s.duration_seconds for s in sessions if s.duration_seconds)
    total_minutes = round(total_seconds / 60.0, 1)

    technique_counts: Dict[str, int] = {}
    for s in sessions:
        title = (s.technique_title or "").strip()
        if title:
            technique_counts[title] = technique_counts.get(title, 0) + 1

    favorite_technique = max(technique_counts.keys(), key=lambda k: technique_counts[k]) if technique_counts else "—"

    # Count distinct days meditated
    distinct_dates = {s.created_at.date() for s in sessions if s.created_at}
    total_days_meditated = len(distinct_dates)

    # Today's sessions
    today = date.today()
    today_sessions = [s for s in sessions if s.created_at and s.created_at.date() == today]

    return {
        "total_sessions": total_sessions,
        "total_minutes": total_minutes,
        "total_days_meditated": total_days_meditated,
        "favorite_technique": favorite_technique,
        "completed_today": len(today_sessions) > 0,
        "today_sessions_count": len(today_sessions),
        "today_minutes": round(sum(s.duration_seconds for s in today_sessions if s.duration_seconds) / 60.0, 1),
    }
