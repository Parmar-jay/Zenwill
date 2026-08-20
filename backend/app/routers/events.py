from fastapi import APIRouter, Depends
from datetime import datetime
from app.models.user import User
from app.models.behavioral_event import BehavioralEvent
from app.schemas.analytics import BehavioralEventRequest
from app.middleware.auth_middleware import get_current_user

from app.services.mind_profile_service import get_or_create_mind_profile
from typing import Optional, List

router = APIRouter(prefix="/events", tags=["Behavioral Events"])


@router.post("/", status_code=201)
async def log_event(
    payload: BehavioralEventRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Log any meaningful user interaction as a behavioral event with deep user context.
    Persists data to 'behavioral_events' MongoDB collection.
    """
    now = datetime.utcnow()
    profile = await get_or_create_mind_profile(current_user)

    event = BehavioralEvent(
        user_id=str(current_user.id),
        user_email=current_user.email,
        user_name=current_user.name or "Operative",
        user_streak=current_user.streak,
        mind_strength_at_event=profile.mind_strength,
        event_type=payload.event_type,
        screen_name=payload.screen_name,
        feature_name=payload.feature_name,
        emotional_state=payload.emotional_state,
        trigger_context=payload.trigger_context,
        location_tag=payload.location_tag,
        outcome=payload.outcome,
        intensity=payload.intensity,
        impact_score=payload.impact_score,
        duration_seconds=payload.duration_seconds,
        device_info=payload.device_info,
        app_version=payload.app_version,
        hour_of_day=now.hour,
        day_of_week=now.weekday(),
        event_metadata=payload.metadata or {},
        created_at=now,
    )
    await event.insert()

    # Also log to mind_profile activity_log
    activity_entry = {
        "timestamp": now.isoformat(),
        "activity_type": payload.event_type,
        "feature_name": payload.feature_name or payload.screen_name or payload.event_type,
        "details": payload.trigger_context or payload.outcome or "",
        "metadata": payload.metadata or {},
    }
    history = list(profile.activity_log or [])
    history.append(activity_entry)
    profile.activity_log = history[-100:]
    await profile.save()

    return {"success": True, "event_id": str(event.id)}


@router.get("/history")
async def get_event_history(
    limit: int = 50,
    event_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Retrieve detailed behavioral event log for the current user."""
    query = BehavioralEvent.find(BehavioralEvent.user_id == str(current_user.id))
    if event_type:
        query = query.find(BehavioralEvent.event_type == event_type)

    events = await query.sort("-created_at").limit(limit).to_list()
    return events


@router.get("/analytics")
async def get_event_analytics(
    current_user: User = Depends(get_current_user),
):
    """Analyze behavioral events to identify triggers, high-risk hours, and progress trends."""
    events = await BehavioralEvent.find(BehavioralEvent.user_id == str(current_user.id)).to_list()

    total_events = len(events)
    events_by_type: dict = {}
    hourly_distribution: dict = {}
    outcomes: dict = {}

    for ev in events:
        events_by_type[ev.event_type] = events_by_type.get(ev.event_type, 0) + 1
        if ev.hour_of_day is not None:
            hourly_distribution[ev.hour_of_day] = hourly_distribution.get(ev.hour_of_day, 0) + 1
        if ev.outcome:
            outcomes[ev.outcome] = outcomes.get(ev.outcome, 0) + 1

    return {
        "total_events": total_events,
        "events_by_type": events_by_type,
        "hourly_distribution": hourly_distribution,
        "outcomes_summary": outcomes,
    }
